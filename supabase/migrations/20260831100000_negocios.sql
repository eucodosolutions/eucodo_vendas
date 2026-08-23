-- O negocio vira cadastro, e a rota de amanha passa a existir no sistema.
--
-- Ate aqui o negocio nao era uma coisa: era tres campos soltos dentro do item
-- do pedido (`nome_negocio`, `link_avaliacao`, `google_place_id`), redigitados
-- do zero a cada venda. Isso custava de tres jeitos:
--
--   1. Dinheiro. Cada busca no Places e paga, e a segunda placa do mesmo
--      negocio pagava a busca de novo.
--   2. Acrilico. Link redigitado erra mais que link conferido uma vez e
--      reusado, e link errado vira QR errado impresso.
--   3. Prospeccao. Negocio visitado que nao fechou nao deixava rastro nenhum:
--      no dia seguinte ninguem sabia por onde ja se tinha passado.
--
-- Duas coisas que este arquivo NAO faz, e de proposito:
--
--   - Nao liga negocio a cliente. Cliente e quem paga, e exige WhatsApp; ao
--     planejar a rota nao existe WhatsApp de ninguem ainda. Um cliente pode
--     levar placa de dois negocios, e um negocio pode ser pago por gente
--     diferente em duas compras. Sao dois cadastros, e continuam separados.
--   - Nao tira `nome_negocio` nem `link_avaliacao` do item. Eles continuam
--     carimbados no dia da venda, como `produto_nome` e o preco: renomear o
--     negocio depois nao pode mudar o que ja foi impresso. O `negocio_id` novo
--     e ponteiro de historico, e nao a fonte do que vai na placa.

-- ---------------------------------------------------------------------------
-- Negocios
-- ---------------------------------------------------------------------------

create table public.negocios (
  id uuid primary key default gen_random_uuid(),
  assinatura_id uuid not null references public.assinaturas (id) on delete cascade,

  -- O nome que o vendedor escolheu, e nao necessariamente o que o Google
  -- devolveu: "Barbearia Vintage LTDA" nao e o que o dono quer no acrilico.
  nome text not null check (length(trim(nome)) > 0),

  -- A identidade do negocio dentro do sistema. Nao e o place id porque o link
  -- colado a mao nao tem place id nenhum, e esse caminho e o de quem ja
  -- gerencia o proprio perfil e chega com o link na mao.
  link_avaliacao text not null check (length(trim(link_avaliacao)) > 0),
  google_place_id text,

  -- Vem de graca da busca, e e o que faz a lista servir para montar rota.
  endereco text,
  observacoes text,

  criado_por uuid references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create trigger negocios_atualizado_em
  before update on public.negocios
  for each row execute function public.tocar_atualizado_em();

-- A unicidade e por autor, pelo mesmo motivo da de cliente: o vendedor nao ve
-- os negocios do assinante, entao um unico por conta o barraria num cadastro
-- que ele nao tem como encontrar para escolher.
--
-- Sem NULLS NOT DISTINCT, tambem como la: `criado_por` so fica nulo quando o
-- perfil de quem cadastrou e apagado, e as linhas orfas precisam conviver.
create unique index negocios_link_por_autor
  on public.negocios (assinatura_id, link_avaliacao, criado_por);

create index negocios_conta_idx on public.negocios (assinatura_id, nome);
create index negocios_autor_idx on public.negocios (criado_por);

-- ---------------------------------------------------------------------------
-- O item aponta para o negocio
--
-- `on delete set null` e nao `restrict`: apagar um negocio da agenda nao pode
-- travar por causa de uma venda de tres meses atras, e o item nao perde nada
-- com isso — o nome e o link que foram impressos estao carimbados nele.
-- ---------------------------------------------------------------------------

alter table public.pedido_itens
  add column negocio_id uuid references public.negocios (id) on delete set null;

create index pedido_itens_negocio_idx on public.pedido_itens (negocio_id)
  where negocio_id is not null;

-- ---------------------------------------------------------------------------
-- O que ja foi vendido vira agenda
--
-- Todo negocio que ja levou placa entra na lista de quem vendeu para ele. Sem
-- isto a tela nova nasce vazia justamente para quem mais tem historico, e o
-- primeiro pedido repetido depois do deploy criaria cadastro duplicado de um
-- negocio que o sistema ja conhecia.
-- ---------------------------------------------------------------------------

insert into public.negocios
  (assinatura_id, nome, link_avaliacao, google_place_id, criado_por, criado_em)
select distinct on (ped.assinatura_id, i.link_avaliacao, ped.criado_por)
       ped.assinatura_id, i.nome_negocio, i.link_avaliacao, i.google_place_id,
       ped.criado_por, i.criado_em
  from public.pedido_itens i
  join public.pedidos ped on ped.id = i.pedido_id
 where i.link_avaliacao is not null
   and i.nome_negocio is not null
 -- O mais recente ganha: e o nome que a pessoa corrigiu na ultima vez que
 -- vendeu para este negocio.
 order by ped.assinatura_id, i.link_avaliacao, ped.criado_por, i.criado_em desc
on conflict do nothing;

-- O cliente tambem carregava link, de quando o link era dele. As colunas
-- ficaram sem uso desde que o link virou coisa do item, e o que sobrou nelas e
-- justamente cadastro de negocio esperando uma tabela.
insert into public.negocios
  (assinatura_id, nome, link_avaliacao, google_place_id, criado_por, criado_em)
select c.assinatura_id, c.nome, c.link_avaliacao, c.google_place_id,
       c.criado_por, c.criado_em
  from public.clientes c
 where c.link_avaliacao is not null
   and length(trim(c.link_avaliacao)) > 0
on conflict do nothing;

update public.pedido_itens i
   set negocio_id = n.id
  from public.pedidos ped
  join public.negocios n on n.assinatura_id = ped.assinatura_id
 where i.pedido_id = ped.id
   and i.link_avaliacao is not null
   and n.link_avaliacao = i.link_avaliacao
   and n.criado_por is not distinct from ped.criado_por;

-- Agora que o conteudo mora em `negocios`, as duas colunas mortas saem. Elas ja
-- eram campo minado: toda edicao de cliente precisava lembrar de nao lista-las
-- para nao apaga-las sem querer, e o comentario que explicava isso vivia em
-- `clientes/actions.ts`.
alter table public.clientes
  drop column link_avaliacao,
  drop column google_place_id;

-- ---------------------------------------------------------------------------
-- RLS
--
-- Mesmo desenho de `clientes`: o vendedor manda no que cadastrou, o assinante
-- manda na conta inteira, o admin so le.
-- ---------------------------------------------------------------------------

alter table public.negocios enable row level security;

create policy "negocios visiveis" on public.negocios
  for select to authenticated
  using (
    public.usuario_admin()
    or (public.usuario_ativo()
        and assinatura_id = public.minha_assinatura()
        and (public.usuario_assinante() or criado_por = auth.uid()))
  );

create policy "negocios criados por ativo" on public.negocios
  for insert to authenticated
  with check (
    public.usuario_ativo()
    and assinatura_id = public.minha_assinatura()
    and criado_por = auth.uid()
  );

-- O `with check` prende `criado_por` pelo mesmo motivo do cliente: sem ele o
-- vendedor conseguiria passar o negocio para outra pessoa da equipe e sumir com
-- ele da propria lista na mesma gravacao.
create policy "negocios editados por quem cadastrou" on public.negocios
  for update to authenticated
  using (
    public.usuario_ativo()
    and assinatura_id = public.minha_assinatura()
    and (public.usuario_assinante() or criado_por = auth.uid())
  )
  with check (
    public.usuario_ativo()
    and assinatura_id = public.minha_assinatura()
    and (public.usuario_assinante() or criado_por = auth.uid())
  );

create policy "negocios apagados por quem cadastrou" on public.negocios
  for delete to authenticated
  using (
    public.usuario_ativo()
    and assinatura_id = public.minha_assinatura()
    and (public.usuario_assinante() or criado_por = auth.uid())
  );

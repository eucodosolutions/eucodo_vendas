-- Produto vira cadastro com tipo, e a comissao sai do vendedor.
--
-- Ate aqui o sistema so sabia vender uma coisa: display de acrilico para
-- avaliacao do Google. Isso estava no schema, nao so na tela — a tabela que
-- fazia papel de produto se chamava `tamanhos`, e cada tamanho tinha quatro
-- variantes fixas (branco/preto x QR/QR+NFC). Quem assina e quer vender uma
-- camiseta ou um servico nao tinha onde cadastrar.
--
-- Tres mudancas de fundo, pedidas pelo Joel em 22/08/2026:
--
--   1. `produtos` guarda o que todo produto tem; `produto_avaliacao` guarda o
--      que so a placa tem (medidas, cores e tecnologias oferecidas).
--   2. Preco unico por produto. Cor e tecnologia viram escolha na venda, sem
--      mexer no valor, e a tabela `variantes` deixa de existir.
--   3. Comissao passa a ser percentual do produto. `perfis.comissao_percentual`
--      sai, e o valor a repassar fica carimbado por item no dia da venda: mudar
--      o percentual depois nao alcanca pedido antigo.

-- ---------------------------------------------------------------------------
-- Produtos
-- ---------------------------------------------------------------------------

create type public.tipo_produto as enum ('avaliacao', 'padrao');

create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  assinatura_id uuid not null references public.assinaturas (id) on delete cascade,
  tipo public.tipo_produto not null,

  codigo text not null,
  nome text not null check (length(trim(nome)) > 0),
  descricao text,
  -- A placa nao usa: a imagem dela e a arte gerada no fechamento do pedido.
  foto_path text,

  preco_centavos integer not null check (preco_centavos >= 0),
  comissao_percentual numeric(5, 2) not null default 0
    check (comissao_percentual >= 0 and comissao_percentual <= 100),
  prazo_entrega_dias integer not null default 3
    check (prazo_entrega_dias between 0 and 365),

  ativo boolean not null default true,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  unique (assinatura_id, codigo),
  -- Serve a chave estrangeira composta do detalhe, logo abaixo.
  unique (id, assinatura_id),

  -- Produto padrao nao tem arte para mostrar o que e: a descricao e a unica
  -- coisa que explica ao cliente o que ele esta comprando.
  constraint padrao_precisa_de_descricao check (
    tipo <> 'padrao' or (descricao is not null and length(trim(descricao)) > 0)
  )
);

create trigger produtos_atualizado_em
  before update on public.produtos
  for each row execute function public.tocar_atualizado_em();

create index produtos_conta_idx on public.produtos (assinatura_id, ordem) where ativo;

-- O detalhe repete `assinatura_id` pelo mesmo motivo que a antiga `variantes`:
-- a chave composta impede apontar para produto de outra conta, e a policy fica
-- uma comparacao direta em vez de subselect.
create table public.produto_avaliacao (
  produto_id uuid primary key references public.produtos (id) on delete cascade,
  assinatura_id uuid not null,

  largura_mm numeric(6, 2) not null check (largura_mm > 0),
  altura_mm numeric(6, 2) not null check (altura_mm > 0),
  margem_seguranca_mm numeric(5, 2) not null default 7 check (margem_seguranca_mm >= 0),
  sangria_mm numeric(5, 2) not null default 0 check (sangria_mm >= 0),
  dpi integer not null default 300 check (dpi between 72 and 1200),

  -- O que este produto oferece na venda. Array e nao tabela: sao dois eixos de
  -- no maximo dois valores cada, e virar linha so criaria juncao para nada.
  cores public.cor_arte[] not null
    check (array_length(cores, 1) >= 1
           and array_position(cores, null::public.cor_arte) is null),
  tecnologias public.tecnologia_arte[] not null
    check (array_length(tecnologias, 1) >= 1
           and array_position(tecnologias, null::public.tecnologia_arte) is null),

  foreign key (produto_id, assinatura_id)
    references public.produtos (id, assinatura_id) on delete cascade
);

/** Detalhe de placa em produto padrao seria dado orfao que ninguem le. */
create or replace function public.so_produto_de_avaliacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.produtos
     where id = new.produto_id and tipo = 'avaliacao'
  ) then
    raise exception 'Medidas de placa so valem para produto do tipo avaliacao';
  end if;

  return new;
end;
$$;

create trigger produto_avaliacao_confere_o_tipo
  before insert or update on public.produto_avaliacao
  for each row execute function public.so_produto_de_avaliacao();

-- ---------------------------------------------------------------------------
-- Semente
--
-- Uma linha por produto agora, e nao mais uma por SKU. O preco semeado e o de
-- QR+NFC: com preco unico, comecar pelo menor faria a conta vender NFC pelo
-- valor do QR ate o assinante perceber.
-- ---------------------------------------------------------------------------

drop function if exists public.clonar_catalogo(uuid);
drop table public.catalogo_modelo;

create table public.catalogo_modelo (
  id uuid primary key default gen_random_uuid(),
  tipo public.tipo_produto not null,
  codigo text not null unique,
  nome text not null,
  descricao text,
  preco_centavos integer not null check (preco_centavos >= 0),
  comissao_percentual numeric(5, 2) not null default 0,
  prazo_entrega_dias integer not null default 3,
  ordem integer not null default 0,
  largura_mm numeric(6, 2),
  altura_mm numeric(6, 2),
  margem_seguranca_mm numeric(5, 2) not null default 7,
  sangria_mm numeric(5, 2) not null default 0,
  dpi integer not null default 300,
  cores public.cor_arte[],
  tecnologias public.tecnologia_arte[]
);

alter table public.catalogo_modelo enable row level security;
-- Sem policy nenhuma: so a chave de servico e as funcoes SECURITY DEFINER leem.

insert into public.catalogo_modelo
  (tipo, codigo, nome, descricao, preco_centavos, ordem,
   largura_mm, altura_mm, cores, tecnologias)
values
  ('avaliacao', 'A6', 'Display A6',
   'Display de acrilico A6 para avaliacao no Google.', 5900, 1,
   107, 150, array['branco', 'preto']::public.cor_arte[],
   array['qr', 'qr_nfc']::public.tecnologia_arte[]),
  ('avaliacao', 'A5', 'Display A5',
   'Display de acrilico A5 para avaliacao no Google.', 7900, 2,
   150, 212, array['branco', 'preto']::public.cor_arte[],
   array['qr', 'qr_nfc']::public.tecnologia_arte[]);

/** Copia o catalogo modelo para uma assinatura recem-criada. */
create or replace function public.clonar_catalogo(p_assinatura uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.produtos
    (assinatura_id, tipo, codigo, nome, descricao,
     preco_centavos, comissao_percentual, prazo_entrega_dias, ordem)
  select p_assinatura, m.tipo, m.codigo, m.nome, m.descricao,
         m.preco_centavos, m.comissao_percentual, m.prazo_entrega_dias, m.ordem
    from public.catalogo_modelo m
  on conflict (assinatura_id, codigo) do nothing;

  insert into public.produto_avaliacao
    (produto_id, assinatura_id, largura_mm, altura_mm,
     margem_seguranca_mm, sangria_mm, dpi, cores, tecnologias)
  select p.id, p_assinatura, m.largura_mm, m.altura_mm,
         m.margem_seguranca_mm, m.sangria_mm, m.dpi, m.cores, m.tecnologias
    from public.catalogo_modelo m
    join public.produtos p
      on p.assinatura_id = p_assinatura and p.codigo = m.codigo
   where m.tipo = 'avaliacao'
  on conflict (produto_id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Migra o catalogo que ja existe
--
-- Um produto por tamanho, herdando o id do tamanho para os pedidos antigos
-- continuarem apontando para a coisa certa. O preco vem da variante mais cara
-- do tamanho, pelo mesmo motivo da semente.
-- ---------------------------------------------------------------------------

insert into public.produtos
  (id, assinatura_id, tipo, codigo, nome, descricao, preco_centavos,
   comissao_percentual, prazo_entrega_dias, ativo, ordem, criado_em, atualizado_em)
select t.id, t.assinatura_id, 'avaliacao', t.codigo, t.rotulo,
       'Display de acrilico ' || t.rotulo || ' para avaliacao no Google.',
       coalesce(
         (select max(v.preco_centavos) from public.variantes v where v.tamanho_id = t.id),
         0
       ),
       0, coalesce(c.prazo_producao_dias, 3), t.ativo, t.ordem, t.criado_em, t.atualizado_em
  from public.tamanhos t
  left join public.configuracoes c on c.assinatura_id = t.assinatura_id;

insert into public.produto_avaliacao
  (produto_id, assinatura_id, largura_mm, altura_mm,
   margem_seguranca_mm, sangria_mm, dpi, cores, tecnologias)
select t.id, t.assinatura_id, t.largura_mm, t.altura_mm,
       t.margem_seguranca_mm, t.sangria_mm, t.dpi,
       coalesce(
         (select array_agg(distinct v.cor) from public.variantes v
           where v.tamanho_id = t.id and v.ativo),
         array['branco', 'preto']::public.cor_arte[]
       ),
       coalesce(
         (select array_agg(distinct v.tecnologia) from public.variantes v
           where v.tamanho_id = t.id and v.ativo),
         array['qr', 'qr_nfc']::public.tecnologia_arte[]
       )
  from public.tamanhos t;

-- ---------------------------------------------------------------------------
-- Pedido e item
-- ---------------------------------------------------------------------------

-- O pedido inteiro sai quando o item mais lento fica pronto.
alter table public.pedidos
  add column prazo_entrega_dias integer not null default 0
    check (prazo_entrega_dias >= 0);

-- Deixou de ser um numero so: cada item pode render um percentual diferente.
-- O que interessa ao vendedor e o valor em reais, e esse continua carimbado em
-- `comissao_centavos`.
alter table public.pedidos drop column comissao_percentual;

alter table public.pedido_itens
  add column produto_id uuid references public.produtos (id) on delete restrict,
  add column tipo public.tipo_produto,
  add column produto_nome text,
  add column prazo_entrega_dias integer not null default 0
    check (prazo_entrega_dias >= 0),
  add column comissao_percentual numeric(5, 2) not null default 0
    check (comissao_percentual >= 0 and comissao_percentual <= 100),
  add column comissao_centavos integer not null default 0
    check (comissao_centavos >= 0);

-- `tamanho_codigo` passaria a mentir no dia em que o primeiro produto padrao
-- for vendido: nao existe tamanho nenhum ali.
alter table public.pedido_itens rename column tamanho_codigo to produto_codigo;

-- Item que ja existe e placa, e o produto novo herdou o id do tamanho antigo.
update public.pedido_itens i
   set produto_id = v.tamanho_id,
       tipo = 'avaliacao',
       produto_nome = p.nome,
       prazo_entrega_dias = p.prazo_entrega_dias
  from public.variantes v
  join public.produtos p on p.id = v.tamanho_id
 where v.id = i.variante_id;

-- O check de `nome_negocio` continua valido depois de a coluna aceitar nulo:
-- `length(trim(null)) > 0` da NULL, e check com NULL passa.
alter table public.pedido_itens
  drop column variante_id,
  alter column produto_id set not null,
  alter column tipo set not null,
  alter column produto_nome set not null,
  alter column nome_negocio drop not null,
  alter column link_avaliacao drop not null;

alter table public.pedido_itens
  add constraint item_coerente_com_o_tipo check (
    (tipo = 'avaliacao'
      and cor is not null and tecnologia is not null
      and nome_negocio is not null and link_avaliacao is not null)
    or
    (tipo = 'padrao'
      and cor is null and tecnologia is null
      and nome_negocio is null and link_avaliacao is null)
  );

create index pedido_itens_produto_idx on public.pedido_itens (produto_id);

-- ---------------------------------------------------------------------------
-- Comissao
--
-- Dois gatilhos, com donos separados: um carimba o item no dia da venda, o
-- outro soma o pedido. O preco unitario continua vindo da aplicacao, que o le
-- do banco — o navegador nunca manda preco.
-- ---------------------------------------------------------------------------

/**
 * Carimba a comissao do item a partir do produto.
 *
 * Carimbar no insert e o que faz mudar o percentual em Ajustes sem alcancar
 * pedido fechado. E continua valendo a regra antiga: comissao so existe quando
 * quem abriu o pedido e vendedor — pedido do proprio assinante, ou vindo do
 * link publico, nao gera comissao para ninguem.
 */
create or replace function public.carimbar_item_do_pedido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_percentual numeric(5, 2);
begin
  if tg_op = 'INSERT' then
    select coalesce(pr.comissao_percentual, 0)
      into v_percentual
      from public.produtos pr
     where pr.id = new.produto_id
       and exists (
         select 1
           from public.pedidos ped
           join public.perfis pe on pe.id = ped.criado_por and pe.papel = 'vendedor'
          where ped.id = new.pedido_id
       );

    new.comissao_percentual := coalesce(v_percentual, 0);
  else
    -- Corrigir a quantidade de um pedido aberto recalcula o valor, mas pelo
    -- percentual do dia da venda: o de hoje pode ja ser outro.
    new.comissao_percentual := old.comissao_percentual;
  end if;

  new.comissao_centavos := round(
    new.quantidade * new.preco_unitario_centavos * new.comissao_percentual / 100
  )::integer;

  return new;
end;
$$;

create trigger pedido_itens_carimbam_comissao
  before insert
  or update of quantidade, preco_unitario_centavos
  on public.pedido_itens
  for each row execute function public.carimbar_item_do_pedido();

/**
 * O total do pedido, a comissao e o prazo sao conta do banco, nao da aplicacao.
 *
 * O pedido entra por dois caminhos, o painel e o link publico, e regra de
 * dinheiro escrita em dois lugares e regra que vai divergir.
 */
create or replace function public.recalcular_pedido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido uuid;
begin
  -- Em gatilho de DELETE o registro NEW nem existe: ler dele levanta erro.
  if tg_op = 'DELETE' then
    v_pedido := old.pedido_id;
  else
    v_pedido := new.pedido_id;
  end if;

  update public.pedidos ped
     set total_centavos = coalesce(soma.total, 0),
         comissao_centavos = coalesce(soma.comissao, 0),
         prazo_entrega_dias = coalesce(soma.prazo, 0)
    from (
      select sum(total_centavos) as total,
             sum(comissao_centavos) as comissao,
             max(prazo_entrega_dias) as prazo
        from public.pedido_itens
       where pedido_id = v_pedido
    ) soma
   where ped.id = v_pedido;

  return null;
end;
$$;

drop trigger if exists pedido_itens_recalculam on public.pedido_itens;

-- Sem `update of`: a comissao do item ja vem carimbada pelo gatilho anterior, e
-- o que sobra aqui e somar o que estiver gravado.
create trigger pedido_itens_recalculam
  after insert or update or delete
  on public.pedido_itens
  for each row execute function public.recalcular_pedido();

-- Reprocessa o que ja existe, para o prazo do pedido deixar de ser zero. A
-- comissao dos pedidos antigos fica como esta: o valor carimbado na venda e o
-- combinado com o vendedor, e recalcular apagaria justamente isso.
update public.pedidos ped
   set prazo_entrega_dias = coalesce(
     (select max(prazo_entrega_dias) from public.pedido_itens where pedido_id = ped.id),
     0
   );

-- ---------------------------------------------------------------------------
-- Comissao sai do vendedor
--
-- O gatilho que trava campo de perfil e reescrito sem a linha da comissao, que
-- deixaria de compilar assim que a coluna sumisse.
-- ---------------------------------------------------------------------------

create or replace function public.travar_campos_do_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sem auth.uid() a chamada veio da chave de servico, de dentro de uma Edge
  -- Function, que e justamente quem precisa gravar esses campos.
  if auth.uid() is null or public.usuario_admin() then
    return new;
  end if;

  -- O assinante manda na propria equipe, mas nao na propria linha.
  if public.usuario_assinante()
     and new.id <> auth.uid()
     and new.assinatura_id = public.minha_assinatura()
     and new.papel = 'vendedor' then
    return new;
  end if;

  new.papel := old.papel;
  new.status := old.status;
  new.assinatura_id := old.assinatura_id;
  return new;
end;
$$;

alter table public.perfis drop column comissao_percentual;

-- ---------------------------------------------------------------------------
-- RLS do catalogo novo, e adeus ao antigo
-- ---------------------------------------------------------------------------

alter table public.produtos enable row level security;
alter table public.produto_avaliacao enable row level security;

create policy "produtos visiveis" on public.produtos
  for select to authenticated
  using (public.usuario_admin() or (public.usuario_ativo() and assinatura_id = public.minha_assinatura()));

create policy "assinante edita produtos" on public.produtos
  for all to authenticated
  using (public.usuario_assinante() and assinatura_id = public.minha_assinatura())
  with check (public.usuario_assinante() and assinatura_id = public.minha_assinatura());

create policy "detalhe de placa visivel" on public.produto_avaliacao
  for select to authenticated
  using (public.usuario_admin() or (public.usuario_ativo() and assinatura_id = public.minha_assinatura()));

create policy "assinante edita detalhe de placa" on public.produto_avaliacao
  for all to authenticated
  using (public.usuario_assinante() and assinatura_id = public.minha_assinatura())
  with check (public.usuario_assinante() and assinatura_id = public.minha_assinatura());

drop table public.variantes;
drop table public.tamanhos;

-- ---------------------------------------------------------------------------
-- Storage: foto de produto
--
-- Bucket publico, ao contrario do das artes. A foto de produto e material de
-- vitrine: vai no catalogo publico e no WhatsApp, onde URL assinada expiraria
-- no meio da conversa. Escrever, so o dono da conta, e so na pasta dela.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('produtos', 'produtos', true)
on conflict (id) do nothing;

create policy "fotos gravadas pela propria conta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'produtos'
    and public.usuario_assinante()
    and (storage.foldername(name))[1] = public.minha_assinatura()::text
  );

create policy "fotos trocadas pela propria conta" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'produtos'
    and public.usuario_assinante()
    and (storage.foldername(name))[1] = public.minha_assinatura()::text
  )
  with check (
    bucket_id = 'produtos'
    and public.usuario_assinante()
    and (storage.foldername(name))[1] = public.minha_assinatura()::text
  );

create policy "fotos apagadas pela propria conta" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'produtos'
    and public.usuario_assinante()
    and (storage.foldername(name))[1] = public.minha_assinatura()::text
  );

-- Catalogo por assinante, cadastro de cliente e pedido com varios itens.
--
-- Tres mudancas de fundo, todas pedidas pelo Joel em 22/08/2026:
--
--   1. Cada assinante tem o proprio catalogo de placas. Tamanho e preco deixam
--      de ser do sistema e passam a ser da conta.
--   2. Cliente vira cadastro proprio, com nome e WhatsApp obrigatorios. Antes o
--      "cliente" era um campo de texto perdido dentro do pedido.
--   3. Pedido passa a ter itens. O caso que motivou: chegar num cliente que quer
--      duas placas, cada uma para uma empresa diferente, num pedido so.

-- ---------------------------------------------------------------------------
-- Catalogo modelo
--
-- Tabela chata, sem dono, que nao aparece para ninguem no app: e a semente que
-- a assinatura nova copia. A alternativa seria deixar linhas de template dentro
-- de `tamanhos` com assinatura nula, que e o jeito classico de vazar dado de
-- uma conta para outra num descuido de policy.
-- ---------------------------------------------------------------------------

create table public.catalogo_modelo (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  rotulo text not null,
  largura_mm numeric(6, 2) not null check (largura_mm > 0),
  altura_mm numeric(6, 2) not null check (altura_mm > 0),
  margem_seguranca_mm numeric(5, 2) not null default 7 check (margem_seguranca_mm >= 0),
  sangria_mm numeric(5, 2) not null default 0 check (sangria_mm >= 0),
  dpi integer not null default 300 check (dpi between 72 and 1200),
  ordem integer not null default 0,
  cor public.cor_arte not null,
  tecnologia public.tecnologia_arte not null,
  preco_centavos integer not null check (preco_centavos >= 0),
  unique (codigo, cor, tecnologia)
);

alter table public.catalogo_modelo enable row level security;
-- Sem policy nenhuma: so a chave de servico e as funcoes SECURITY DEFINER leem.

insert into public.catalogo_modelo
  (codigo, rotulo, largura_mm, altura_mm, ordem, cor, tecnologia, preco_centavos)
values
  ('A6', 'A6', 107, 150, 1, 'branco', 'qr', 3900),
  ('A6', 'A6', 107, 150, 1, 'preto', 'qr', 3900),
  ('A6', 'A6', 107, 150, 1, 'branco', 'qr_nfc', 5900),
  ('A6', 'A6', 107, 150, 1, 'preto', 'qr_nfc', 5900),
  ('A5', 'A5', 150, 212, 2, 'branco', 'qr', 5900),
  ('A5', 'A5', 150, 212, 2, 'preto', 'qr', 5900),
  ('A5', 'A5', 150, 212, 2, 'branco', 'qr_nfc', 7900),
  ('A5', 'A5', 150, 212, 2, 'preto', 'qr_nfc', 7900);

-- ---------------------------------------------------------------------------
-- Tamanhos e variantes, agora com dono
-- ---------------------------------------------------------------------------

create table public.tamanhos (
  id uuid primary key default gen_random_uuid(),
  assinatura_id uuid not null references public.assinaturas (id) on delete cascade,
  codigo text not null,
  rotulo text not null,
  largura_mm numeric(6, 2) not null check (largura_mm > 0),
  altura_mm numeric(6, 2) not null check (altura_mm > 0),
  margem_seguranca_mm numeric(5, 2) not null default 7 check (margem_seguranca_mm >= 0),
  sangria_mm numeric(5, 2) not null default 0 check (sangria_mm >= 0),
  dpi integer not null default 300 check (dpi between 72 and 1200),
  ordem integer not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (assinatura_id, codigo),
  -- Serve a chave estrangeira composta da variante, logo abaixo.
  unique (id, assinatura_id)
);

create trigger tamanhos_atualizado_em
  before update on public.tamanhos
  for each row execute function public.tocar_atualizado_em();

-- A variante repete `assinatura_id` de proposito. A chave composta abaixo
-- impede que ela aponte para tamanho de outra conta, e a policy fica uma
-- comparacao direta em vez de um subselect em tamanhos.
create table public.variantes (
  id uuid primary key default gen_random_uuid(),
  assinatura_id uuid not null references public.assinaturas (id) on delete cascade,
  tamanho_id uuid not null,
  cor public.cor_arte not null,
  tecnologia public.tecnologia_arte not null,
  preco_centavos integer not null check (preco_centavos >= 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (tamanho_id, cor, tecnologia),
  foreign key (tamanho_id, assinatura_id)
    references public.tamanhos (id, assinatura_id) on delete cascade
);

create trigger variantes_atualizado_em
  before update on public.variantes
  for each row execute function public.tocar_atualizado_em();

create index variantes_conta_idx on public.variantes (assinatura_id) where ativo;

/** Copia o catalogo modelo para uma assinatura recem-criada. */
create or replace function public.clonar_catalogo(p_assinatura uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tamanhos
    (assinatura_id, codigo, rotulo, largura_mm, altura_mm,
     margem_seguranca_mm, sangria_mm, dpi, ordem)
  select distinct on (m.codigo)
    p_assinatura, m.codigo, m.rotulo, m.largura_mm, m.altura_mm,
    m.margem_seguranca_mm, m.sangria_mm, m.dpi, m.ordem
  from public.catalogo_modelo m
  order by m.codigo, m.ordem
  on conflict (assinatura_id, codigo) do nothing;

  insert into public.variantes
    (assinatura_id, tamanho_id, cor, tecnologia, preco_centavos)
  select p_assinatura, t.id, m.cor, m.tecnologia, m.preco_centavos
  from public.catalogo_modelo m
  join public.tamanhos t
    on t.assinatura_id = p_assinatura and t.codigo = m.codigo
  on conflict (tamanho_id, cor, tecnologia) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Configuracoes: uma linha por assinatura
--
-- Era linha unica (`id boolean`), do tempo em que existia uma instalacao so.
-- PIX, prazo e instancia de WhatsApp sao de cada assinante.
-- ---------------------------------------------------------------------------

create table public.configuracoes (
  assinatura_id uuid primary key references public.assinaturas (id) on delete cascade,
  instancia_id uuid references public.instancias_whatsapp (id) on delete set null,
  pix_chave text,
  pix_beneficiario text,
  pix_cidade text,
  prazo_producao_dias integer not null default 3 check (prazo_producao_dias >= 0),
  atualizado_em timestamptz not null default now()
);

create trigger configuracoes_atualizado_em
  before update on public.configuracoes
  for each row execute function public.tocar_atualizado_em();

-- ---------------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------------

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  assinatura_id uuid not null references public.assinaturas (id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  whatsapp text not null check (whatsapp ~ '^[0-9]{12,13}$'),
  google_place_id text,
  link_avaliacao text,
  observacoes text,
  criado_por uuid references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- O mesmo numero nao entra duas vezes na mesma conta: cliente duplicado vira
  -- historico de compra partido em dois.
  unique (assinatura_id, whatsapp)
);

create trigger clientes_atualizado_em
  before update on public.clientes
  for each row execute function public.tocar_atualizado_em();

create index clientes_conta_idx on public.clientes (assinatura_id, nome);
create index clientes_autor_idx on public.clientes (criado_por);

-- ---------------------------------------------------------------------------
-- Pedidos e itens
--
-- O pedido guarda quem comprou e quanto foi. O item guarda o que vai impresso:
-- e no item que mora `nome_negocio`, porque duas placas do mesmo pedido podem
-- ser de empresas diferentes.
-- ---------------------------------------------------------------------------

create sequence public.pedidos_numero_seq start 1;

create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  numero integer not null default nextval('public.pedidos_numero_seq') unique,
  codigo text generated always as ('EV-' || lpad(numero::text, 4, '0')) stored,

  assinatura_id uuid not null references public.assinaturas (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete restrict,

  total_centavos integer not null default 0 check (total_centavos >= 0),

  status public.status_pedido not null default 'novo',
  pagamento public.status_pagamento not null default 'pendente',
  forma_pagamento public.forma_pagamento,
  pago_em timestamptz,
  cancelado_em timestamptz,
  motivo_cancelamento text,

  comissao_percentual numeric(5, 2) not null default 0
    check (comissao_percentual >= 0 and comissao_percentual <= 100),
  comissao_centavos integer not null default 0 check (comissao_centavos >= 0),
  comissao_paga_em timestamptz,

  origem public.origem_pedido not null default 'painel',
  criado_por uuid references public.perfis (id) on delete set null,
  observacoes text,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint pago_precisa_de_forma check (
    (pagamento = 'pago' and forma_pagamento is not null and pago_em is not null)
    or (pagamento = 'pendente' and forma_pagamento is null and pago_em is null)
  ),
  constraint cancelado_precisa_de_data check (
    (status = 'cancelado' and cancelado_em is not null)
    or (status <> 'cancelado' and cancelado_em is null)
  ),
  constraint comissao_quitada_so_com_pedido_pago check (
    comissao_paga_em is null or pagamento = 'pago'
  )
);

create trigger pedidos_atualizado_em
  before update on public.pedidos
  for each row execute function public.tocar_atualizado_em();

create index pedidos_conta_idx on public.pedidos (assinatura_id, criado_em desc);
create index pedidos_status_idx on public.pedidos (assinatura_id, status, criado_em desc);
create index pedidos_cliente_idx on public.pedidos (cliente_id, criado_em desc);
create index pedidos_comissao_idx on public.pedidos (criado_por, pagamento)
  where comissao_centavos > 0;

create table public.pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  ordem integer not null default 1 check (ordem > 0),

  variante_id uuid not null references public.variantes (id) on delete restrict,

  -- O negocio que vai impresso na placa, que nao e o cliente que paga.
  nome_negocio text not null check (length(trim(nome_negocio)) > 0),
  link_avaliacao text not null,
  google_place_id text,

  -- Retrato do catalogo no dia da venda.
  tamanho_codigo text not null,
  cor public.cor_arte not null,
  tecnologia public.tecnologia_arte not null,
  quantidade integer not null default 1 check (quantidade > 0),
  preco_unitario_centavos integer not null check (preco_unitario_centavos >= 0),
  total_centavos integer generated always as (quantidade * preco_unitario_centavos) stored,

  arte_jpg_path text,
  arte_preview_path text,

  criado_em timestamptz not null default now(),

  unique (pedido_id, ordem)
);

create index pedido_itens_pedido_idx on public.pedido_itens (pedido_id, ordem);

/**
 * O total do pedido e a comissao sao conta do banco, nao da aplicacao.
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
  v_total integer;
  v_percentual numeric(5, 2);
begin
  -- Em gatilho de DELETE o registro NEW nem existe: ler dele levanta erro.
  if tg_op = 'DELETE' then
    v_pedido := old.pedido_id;
  else
    v_pedido := new.pedido_id;
  end if;

  select coalesce(sum(total_centavos), 0)
    into v_total
    from public.pedido_itens
   where pedido_id = v_pedido;

  -- Comissao so existe quando quem abriu o pedido e vendedor. Pedido do proprio
  -- assinante, ou vindo do link publico, nao gera comissao para ninguem.
  select coalesce(p.comissao_percentual, 0)
    into v_percentual
    from public.pedidos ped
    left join public.perfis p
      on p.id = ped.criado_por and p.papel = 'vendedor'
   where ped.id = v_pedido;

  update public.pedidos
     set total_centavos = v_total,
         comissao_percentual = coalesce(v_percentual, 0),
         comissao_centavos = round(v_total * coalesce(v_percentual, 0) / 100)::integer
   where id = v_pedido;

  return null;
end;
$$;

-- UPDATE OF nas colunas de dinheiro: gravar o caminho da arte no item nao pode
-- recarimbar comissao com um percentual que pode ter mudado desde a venda.
create trigger pedido_itens_recalculam
  after insert or delete
  or update of quantidade, preco_unitario_centavos
  on public.pedido_itens
  for each row execute function public.recalcular_pedido();

-- ---------------------------------------------------------------------------
-- Auditoria e mensagens
-- ---------------------------------------------------------------------------

create table public.pedido_eventos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  tipo text not null,
  de text,
  para text,
  detalhe text,
  autor_id uuid references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now()
);

create index pedido_eventos_pedido_idx on public.pedido_eventos (pedido_id, criado_em desc);

create table public.mensagens_whatsapp (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid references public.pedidos (id) on delete cascade,
  destino text not null,
  chave_modelo text,
  corpo text not null,
  tem_midia boolean not null default false,
  via public.via_mensagem not null default 'uazapi',
  sucesso boolean not null default false,
  resposta jsonb,
  erro text,
  criado_em timestamptz not null default now()
);

create index mensagens_whatsapp_pedido_idx on public.mensagens_whatsapp (pedido_id, criado_em desc);

-- ---------------------------------------------------------------------------
-- Cadastro: a conta nasce junto com a pessoa
--
-- Precisa ser gatilho, e nao passo da aplicacao: a assinatura, o catalogo e a
-- configuracao tem que existir na mesma transacao do `auth.users`, senao um
-- erro no meio deixa uma conta pela metade que ninguem consegue usar nem apagar.
-- ---------------------------------------------------------------------------

create or replace function public.criar_perfil_do_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
  v_whatsapp text;
  v_papel text;
  v_assinatura uuid;
begin
  v_nome := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'nome'), ''),
    split_part(new.email, '@', 1)
  );
  v_whatsapp := nullif(trim(new.raw_user_meta_data ->> 'whatsapp'), '');
  v_papel := nullif(trim(new.raw_user_meta_data ->> 'papel'), '');

  -- Vendedor so nasce por dentro, criado pelo assinante, com a conta no metadata.
  if v_papel = 'vendedor' then
    v_assinatura := nullif(trim(new.raw_user_meta_data ->> 'assinatura_id'), '')::uuid;

    if v_assinatura is null then
      raise exception 'Vendedor precisa de assinatura';
    end if;

    insert into public.perfis (id, nome, email, whatsapp, papel, status, assinatura_id)
    values (new.id, v_nome, new.email, v_whatsapp, 'vendedor', 'ativo', v_assinatura)
    on conflict (id) do nothing;

    return new;
  end if;

  -- Cadastro pela pagina: assinante novo, conta nova, esperando liberacao.
  insert into public.assinaturas (nome)
  values (coalesce(nullif(trim(new.raw_user_meta_data ->> 'negocio'), ''), v_nome))
  returning id into v_assinatura;

  insert into public.perfis (id, nome, email, whatsapp, papel, status, assinatura_id)
  values (new.id, v_nome, new.email, v_whatsapp, 'assinante', 'pendente', v_assinatura)
  on conflict (id) do nothing;

  perform public.clonar_catalogo(v_assinatura);

  insert into public.configuracoes (assinatura_id)
  values (v_assinatura)
  on conflict (assinatura_id) do nothing;

  return new;
end;
$$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil_do_usuario();

-- ---------------------------------------------------------------------------
-- RLS
--
-- O desenho se repete em toda tabela com dono:
--   admin      le tudo, para o painel da plataforma. Nao escreve nada aqui.
--   assinante  le e escreve tudo da conta dele.
--   vendedor   le o catalogo da conta, e so os pedidos e clientes que sao dele.
-- ---------------------------------------------------------------------------

/** Serve as policies de item, evento e mensagem sem reentrar na RLS de pedidos. */
create or replace function public.pedido_visivel(p_pedido uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.pedidos ped
     where ped.id = p_pedido
       and (
         public.usuario_admin()
         or (ped.assinatura_id = public.minha_assinatura()
             and (public.usuario_assinante() or ped.criado_por = auth.uid()))
       )
  );
$$;

create or replace function public.pedido_editavel(p_pedido uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.pedidos ped
     where ped.id = p_pedido
       and ped.assinatura_id = public.minha_assinatura()
       and (public.usuario_assinante() or ped.criado_por = auth.uid())
  );
$$;

alter table public.tamanhos enable row level security;
alter table public.variantes enable row level security;
alter table public.configuracoes enable row level security;
alter table public.clientes enable row level security;
alter table public.pedidos enable row level security;
alter table public.pedido_itens enable row level security;
alter table public.pedido_eventos enable row level security;
alter table public.mensagens_whatsapp enable row level security;

-- Catalogo: todo mundo da conta ve, so o dono edita.
create policy "tamanhos visiveis" on public.tamanhos
  for select to authenticated
  using (public.usuario_admin() or (public.usuario_ativo() and assinatura_id = public.minha_assinatura()));

create policy "assinante edita tamanhos" on public.tamanhos
  for all to authenticated
  using (public.usuario_assinante() and assinatura_id = public.minha_assinatura())
  with check (public.usuario_assinante() and assinatura_id = public.minha_assinatura());

create policy "variantes visiveis" on public.variantes
  for select to authenticated
  using (public.usuario_admin() or (public.usuario_ativo() and assinatura_id = public.minha_assinatura()));

create policy "assinante edita variantes" on public.variantes
  for all to authenticated
  using (public.usuario_assinante() and assinatura_id = public.minha_assinatura())
  with check (public.usuario_assinante() and assinatura_id = public.minha_assinatura());

-- Configuracoes: o vendedor nao entra, nem para ler. E ali que mora o PIX.
create policy "configuracoes do dono" on public.configuracoes
  for select to authenticated
  using (public.usuario_admin() or (public.usuario_assinante() and assinatura_id = public.minha_assinatura()));

create policy "assinante edita configuracoes" on public.configuracoes
  for update to authenticated
  using (public.usuario_assinante() and assinatura_id = public.minha_assinatura())
  with check (public.usuario_assinante() and assinatura_id = public.minha_assinatura());

-- A instancia de WhatsApp e fornecida pela plataforma, e so o admin enxerga a
-- tabela `instancias_whatsapp`. Sem esta policy nao existiria ninguem capaz de
-- ligar uma conta a uma instancia: o assinante nao ve as instancias, e o admin
-- nao alcancava a linha de configuracao.
create policy "admin liga a instancia da conta" on public.configuracoes
  for update to authenticated
  using (public.usuario_admin()) with check (public.usuario_admin());

-- Clientes: o vendedor ve os que cadastrou, e nao edita nem apaga nenhum.
create policy "clientes visiveis" on public.clientes
  for select to authenticated
  using (
    public.usuario_admin()
    or (public.usuario_ativo()
        and assinatura_id = public.minha_assinatura()
        and (public.usuario_assinante() or criado_por = auth.uid()))
  );

create policy "clientes criados por ativo" on public.clientes
  for insert to authenticated
  with check (
    public.usuario_ativo()
    and assinatura_id = public.minha_assinatura()
    and criado_por = auth.uid()
  );

create policy "assinante edita clientes" on public.clientes
  for update to authenticated
  using (public.usuario_assinante() and assinatura_id = public.minha_assinatura())
  with check (public.usuario_assinante() and assinatura_id = public.minha_assinatura());

create policy "assinante apaga clientes" on public.clientes
  for delete to authenticated
  using (public.usuario_assinante() and assinatura_id = public.minha_assinatura());

-- Pedidos
create policy "pedidos visiveis" on public.pedidos
  for select to authenticated
  using (
    public.usuario_admin()
    or (public.usuario_ativo()
        and assinatura_id = public.minha_assinatura()
        and (public.usuario_assinante() or criado_por = auth.uid()))
  );

create policy "pedidos criados por ativo" on public.pedidos
  for insert to authenticated
  with check (
    public.usuario_ativo()
    and assinatura_id = public.minha_assinatura()
    and criado_por = auth.uid()
  );

create policy "pedidos editados pelo dono" on public.pedidos
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

create policy "itens visiveis" on public.pedido_itens
  for select to authenticated using (public.pedido_visivel(pedido_id));

create policy "itens escritos com o pedido" on public.pedido_itens
  for insert to authenticated with check (public.pedido_editavel(pedido_id));

create policy "itens editados com o pedido" on public.pedido_itens
  for update to authenticated
  using (public.pedido_editavel(pedido_id))
  with check (public.pedido_editavel(pedido_id));

create policy "eventos visiveis" on public.pedido_eventos
  for select to authenticated using (public.pedido_visivel(pedido_id));

create policy "eventos criados com o pedido" on public.pedido_eventos
  for insert to authenticated with check (public.pedido_editavel(pedido_id));

create policy "mensagens visiveis" on public.mensagens_whatsapp
  for select to authenticated
  using (pedido_id is not null and public.pedido_visivel(pedido_id));

-- ---------------------------------------------------------------------------
-- Storage
--
-- O caminho da arte passa a comecar pela assinatura: `{conta}/{codigo}/{n}.jpg`.
-- Assim a policy e uma comparacao de pasta, e nao uma consulta ao pedido.
--
-- As policies de escrita nao existiam: o bucket so tinha leitura, e o upload da
-- arte pela sessao do vendedor nunca teria passado.
-- ---------------------------------------------------------------------------

drop policy if exists "artes visiveis para ativos" on storage.objects;

create policy "artes da propria conta" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'artes'
    and (
      public.usuario_admin()
      or (storage.foldername(name))[1] = public.minha_assinatura()::text
    )
  );

create policy "artes gravadas pela propria conta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'artes'
    and public.usuario_ativo()
    and (storage.foldername(name))[1] = public.minha_assinatura()::text
  );

create policy "artes regeradas pela propria conta" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'artes'
    and public.usuario_ativo()
    and (storage.foldername(name))[1] = public.minha_assinatura()::text
  )
  with check (
    bucket_id = 'artes'
    and public.usuario_ativo()
    and (storage.foldername(name))[1] = public.minha_assinatura()::text
  );

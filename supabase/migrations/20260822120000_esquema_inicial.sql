-- Esquema inicial do Eucodo Vendas.
--
-- Duas ideias organizam este arquivo:
--   1. Tamanho de display e dado, nao codigo. Quem assinar o sistema cadastra
--      o proprio formato sem depender de deploy.
--   2. Producao e pagamento sao trilhas separadas. Um pedido pode estar pronto
--      e nao pago, ou pago e ainda na fila de producao.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

create type public.papel_usuario as enum ('admin', 'vendedor');
create type public.status_usuario as enum ('pendente', 'ativo', 'bloqueado');

create type public.cor_arte as enum ('branco', 'preto');
create type public.tecnologia_arte as enum ('qr', 'qr_nfc');

create type public.status_pedido as enum (
  'novo',
  'em_producao',
  'pronto',
  'entregue',
  'cancelado'
);

create type public.status_pagamento as enum ('pendente', 'pago');

create type public.forma_pagamento as enum (
  'pix',
  'dinheiro',
  'cartao_credito',
  'cartao_debito',
  'transferencia'
);

create type public.origem_pedido as enum ('painel', 'publico');

-- ---------------------------------------------------------------------------
-- Utilitarios
-- ---------------------------------------------------------------------------

create or replace function public.tocar_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Perfis
--
-- Conta nova entra como 'pendente'. So vira 'ativo' quando um admin liberar,
-- para o formulario de cadastro nao ser porta aberta para o painel de pedidos.
-- ---------------------------------------------------------------------------

create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  email text not null,
  papel public.papel_usuario not null default 'vendedor',
  status public.status_usuario not null default 'pendente',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create trigger perfis_atualizado_em
  before update on public.perfis
  for each row execute function public.tocar_atualizado_em();

-- Cria o perfil junto com o usuario, para nao existir sessao sem perfil.
create or replace function public.criar_perfil_do_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfis (id, nome, email)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil_do_usuario();

-- Usada pelas policies. SECURITY DEFINER evita recursao de RLS em perfis.
create or replace function public.usuario_ativo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfis
    where id = auth.uid() and status = 'ativo'
  );
$$;

create or replace function public.usuario_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfis
    where id = auth.uid() and status = 'ativo' and papel = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Tamanhos e variantes
-- ---------------------------------------------------------------------------

create table public.tamanhos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  rotulo text not null,
  largura_mm numeric(6, 2) not null check (largura_mm > 0),
  altura_mm numeric(6, 2) not null check (altura_mm > 0),
  margem_seguranca_mm numeric(5, 2) not null default 7 check (margem_seguranca_mm >= 0),
  sangria_mm numeric(5, 2) not null default 0 check (sangria_mm >= 0),
  dpi integer not null default 300 check (dpi between 72 and 1200),
  ordem integer not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create trigger tamanhos_atualizado_em
  before update on public.tamanhos
  for each row execute function public.tocar_atualizado_em();

create table public.variantes (
  id uuid primary key default gen_random_uuid(),
  tamanho_id uuid not null references public.tamanhos (id) on delete restrict,
  cor public.cor_arte not null,
  tecnologia public.tecnologia_arte not null,
  preco_centavos integer not null check (preco_centavos >= 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (tamanho_id, cor, tecnologia)
);

create trigger variantes_atualizado_em
  before update on public.variantes
  for each row execute function public.tocar_atualizado_em();

create index variantes_ativas_idx on public.variantes (ativo) where ativo;

-- ---------------------------------------------------------------------------
-- Pedidos
--
-- Os dados da variante sao copiados para o pedido no momento da venda. Preco e
-- medida mudam com o tempo, e o pedido precisa continuar contando a verdade do
-- dia em que foi fechado.
-- ---------------------------------------------------------------------------

create sequence public.pedidos_numero_seq start 1;

create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  numero integer not null default nextval('public.pedidos_numero_seq') unique,
  codigo text generated always as ('EV-' || lpad(numero::text, 4, '0')) stored,

  variante_id uuid not null references public.variantes (id) on delete restrict,

  -- Dados do cliente
  nome_negocio text not null check (length(trim(nome_negocio)) > 0),
  whatsapp text not null check (whatsapp ~ '^[0-9]{12,13}$'),
  link_avaliacao text not null,
  google_place_id text,

  -- Retrato da venda
  tamanho_codigo text not null,
  cor public.cor_arte not null,
  tecnologia public.tecnologia_arte not null,
  quantidade integer not null default 1 check (quantidade > 0),
  preco_unitario_centavos integer not null check (preco_unitario_centavos >= 0),
  total_centavos integer not null check (total_centavos >= 0),

  status public.status_pedido not null default 'novo',
  pagamento public.status_pagamento not null default 'pendente',
  forma_pagamento public.forma_pagamento,
  pago_em timestamptz,
  cancelado_em timestamptz,
  motivo_cancelamento text,

  -- Arquivos gerados, caminhos no Storage
  arte_jpg_path text,
  arte_preview_path text,

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
  )
);

create trigger pedidos_atualizado_em
  before update on public.pedidos
  for each row execute function public.tocar_atualizado_em();

create index pedidos_status_idx on public.pedidos (status, criado_em desc);
create index pedidos_pagamento_idx on public.pedidos (pagamento, criado_em desc);
create index pedidos_criado_em_idx on public.pedidos (criado_em desc);
create index pedidos_whatsapp_idx on public.pedidos (whatsapp);

-- Auditoria: toda mudanca de status vira linha aqui.
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

-- ---------------------------------------------------------------------------
-- WhatsApp
-- ---------------------------------------------------------------------------

create table public.modelos_mensagem (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,
  descricao text not null,
  corpo text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create trigger modelos_mensagem_atualizado_em
  before update on public.modelos_mensagem
  for each row execute function public.tocar_atualizado_em();

create table public.mensagens_whatsapp (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid references public.pedidos (id) on delete cascade,
  destino text not null,
  chave_modelo text,
  corpo text not null,
  tem_midia boolean not null default false,
  sucesso boolean not null default false,
  resposta jsonb,
  erro text,
  criado_em timestamptz not null default now()
);

create index mensagens_whatsapp_pedido_idx on public.mensagens_whatsapp (pedido_id, criado_em desc);

-- ---------------------------------------------------------------------------
-- Configuracoes gerais, uma linha so
-- ---------------------------------------------------------------------------

create table public.configuracoes (
  id boolean primary key default true check (id),
  pix_chave text,
  pix_beneficiario text,
  pix_cidade text,
  prazo_producao_dias integer not null default 3 check (prazo_producao_dias >= 0),
  atualizado_em timestamptz not null default now()
);

create trigger configuracoes_atualizado_em
  before update on public.configuracoes
  for each row execute function public.tocar_atualizado_em();

insert into public.configuracoes (id) values (true);

-- ---------------------------------------------------------------------------
-- RLS
--
-- O anonimo nao enxerga nada. O pedido publico entra por server action com a
-- chave de servico, que valida os dados antes de gravar.
-- ---------------------------------------------------------------------------

alter table public.perfis enable row level security;
alter table public.tamanhos enable row level security;
alter table public.variantes enable row level security;
alter table public.pedidos enable row level security;
alter table public.pedido_eventos enable row level security;
alter table public.modelos_mensagem enable row level security;
alter table public.mensagens_whatsapp enable row level security;
alter table public.configuracoes enable row level security;

create policy "perfil proprio visivel" on public.perfis
  for select to authenticated using (id = auth.uid() or public.usuario_admin());

create policy "perfil proprio editavel" on public.perfis
  for update to authenticated
  using (id = auth.uid() or public.usuario_admin())
  with check (id = auth.uid() or public.usuario_admin());

create policy "admin gerencia perfis" on public.perfis
  for delete to authenticated using (public.usuario_admin());

create policy "tamanhos visiveis" on public.tamanhos
  for select to authenticated using (public.usuario_ativo());

create policy "admin edita tamanhos" on public.tamanhos
  for all to authenticated using (public.usuario_admin()) with check (public.usuario_admin());

create policy "variantes visiveis" on public.variantes
  for select to authenticated using (public.usuario_ativo());

create policy "admin edita variantes" on public.variantes
  for all to authenticated using (public.usuario_admin()) with check (public.usuario_admin());

create policy "pedidos visiveis" on public.pedidos
  for select to authenticated using (public.usuario_ativo());

create policy "pedidos criados por ativo" on public.pedidos
  for insert to authenticated with check (public.usuario_ativo());

create policy "pedidos editados por ativo" on public.pedidos
  for update to authenticated using (public.usuario_ativo()) with check (public.usuario_ativo());

create policy "eventos visiveis" on public.pedido_eventos
  for select to authenticated using (public.usuario_ativo());

create policy "eventos criados por ativo" on public.pedido_eventos
  for insert to authenticated with check (public.usuario_ativo());

create policy "modelos visiveis" on public.modelos_mensagem
  for select to authenticated using (public.usuario_ativo());

create policy "admin edita modelos" on public.modelos_mensagem
  for all to authenticated using (public.usuario_admin()) with check (public.usuario_admin());

create policy "mensagens visiveis" on public.mensagens_whatsapp
  for select to authenticated using (public.usuario_ativo());

create policy "configuracoes visiveis" on public.configuracoes
  for select to authenticated using (public.usuario_ativo());

create policy "admin edita configuracoes" on public.configuracoes
  for update to authenticated using (public.usuario_admin()) with check (public.usuario_admin());

-- ---------------------------------------------------------------------------
-- Storage: as artes ficam em bucket privado, servidas por URL assinada.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('artes', 'artes', false)
on conflict (id) do nothing;

create policy "artes visiveis para ativos" on storage.objects
  for select to authenticated using (bucket_id = 'artes' and public.usuario_ativo());

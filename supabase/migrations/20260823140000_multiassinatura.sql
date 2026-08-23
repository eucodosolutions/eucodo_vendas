-- Eucodo Vendas vira microsaas: tres papeis e uma assinatura por conta.
--
-- O sistema nasceu para um vendedor so. O produto agora tem tres camadas:
--
--   admin      a plataforma. Ve tudo para operar o painel dela, e nao vende.
--   assinante  quem se cadastra pela pagina. Dono da conta, do catalogo, dos
--              clientes e da equipe.
--   vendedor   criado pelo assinante, preso a assinatura dele.
--
-- O Joel confirmou em 22/08/2026 que o banco atual e teste e pode ser refeito.
-- As tabelas de venda sao derrubadas aqui e reconstruidas na migration seguinte,
-- ja com dono. Nenhum usuario e apagado: os perfis que sobraram do teste ficam
-- 'bloqueado', sem assinatura, e podem ser removidos pelo painel do Supabase.

-- ---------------------------------------------------------------------------
-- Limpeza: o que vai ser reconstruido com dono
-- ---------------------------------------------------------------------------

drop table if exists public.pedido_eventos cascade;
drop table if exists public.mensagens_whatsapp cascade;
drop table if exists public.pedidos cascade;
drop table if exists public.variantes cascade;
drop table if exists public.tamanhos cascade;
drop table if exists public.configuracoes cascade;
drop sequence if exists public.pedidos_numero_seq;

drop trigger if exists ao_criar_usuario on auth.users;
drop function if exists public.criar_perfil_do_usuario();

-- ---------------------------------------------------------------------------
-- Papeis
--
-- 'assinante' entra por troca de tipo, e nao por ALTER TYPE ADD VALUE: valor
-- novo de enum nao pode ser usado na mesma transacao em que foi criado, e a
-- action aplica cada migration numa transacao so.
-- ---------------------------------------------------------------------------

alter table public.perfis alter column papel drop default;

create type public.papel_usuario_novo as enum ('admin', 'assinante', 'vendedor');

alter table public.perfis
  alter column papel type public.papel_usuario_novo
  using papel::text::public.papel_usuario_novo;

drop type public.papel_usuario;
alter type public.papel_usuario_novo rename to papel_usuario;

-- Fica sem default de proposito: quem cria perfil e o gatilho de cadastro, e
-- ele decide o papel pelo caminho de entrada. Default aqui seria permissao
-- concedida por esquecimento.

-- ---------------------------------------------------------------------------
-- Assinaturas
--
-- Sem coluna de dono: o dono e o perfil 'assinante' da assinatura, garantido
-- pelo indice unico mais abaixo. Guardar `dono_id` aqui criaria uma chave
-- estrangeira circular entre perfis e assinaturas, com as duas obrigatorias.
-- ---------------------------------------------------------------------------

create type public.status_assinatura as enum ('pendente', 'ativa', 'suspensa', 'cancelada');

create table public.assinaturas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  status public.status_assinatura not null default 'pendente',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create trigger assinaturas_atualizado_em
  before update on public.assinaturas
  for each row execute function public.tocar_atualizado_em();

create index assinaturas_status_idx on public.assinaturas (status, criado_em desc);

-- ---------------------------------------------------------------------------
-- Perfis
-- ---------------------------------------------------------------------------

alter table public.perfis
  add column assinatura_id uuid references public.assinaturas (id) on delete cascade,
  add column comissao_percentual numeric(5, 2) not null default 0
    check (comissao_percentual >= 0 and comissao_percentual <= 100),
  add column senha_temporaria boolean not null default false;

comment on column public.perfis.assinatura_id is
  'Conta a que a pessoa pertence. Nulo so no admin da plataforma.';
comment on column public.perfis.senha_temporaria is
  'Ligado quando o assinante gerou a senha. O painel exige a troca antes de abrir.';

create index perfis_assinatura_idx on public.perfis (assinatura_id)
  where assinatura_id is not null;

-- Uma assinatura tem um dono so.
create unique index perfis_um_assinante_por_conta
  on public.perfis (assinatura_id)
  where papel = 'assinante';

-- O perfil mais antigo do banco e a conta do Joel, a primeira criada: vira o
-- admin da plataforma. O resto e teste e fica bloqueado, sem conta.
update public.perfis
   set papel = 'admin',
       status = 'ativo',
       assinatura_id = null
 where id = (select id from public.perfis order by criado_em asc limit 1);

update public.perfis
   set papel = 'vendedor',
       status = 'bloqueado',
       assinatura_id = null
 where papel <> 'admin';

-- NOT VALID por causa desses restos de teste, que nao tem assinatura nenhuma.
-- Quem entrar ou for alterado daqui para frente obedece.
alter table public.perfis
  add constraint perfis_papel_combina_com_conta check (
    (papel = 'admin' and assinatura_id is null)
    or (papel in ('assinante', 'vendedor') and assinatura_id is not null)
  ) not valid;

-- ---------------------------------------------------------------------------
-- Funcoes que as policies usam
--
-- Todas SECURITY DEFINER: uma policy de perfis que lesse perfis por RLS
-- entraria em recursao.
-- ---------------------------------------------------------------------------

create or replace function public.minha_assinatura()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select assinatura_id from public.perfis where id = auth.uid();
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

/**
 * Perfil liberado E assinatura em dia.
 *
 * As duas condicoes moram aqui, e nao espalhadas por policy, para suspender um
 * assinante derrubar a equipe dele junto sem tocar em mais nada.
 */
create or replace function public.usuario_ativo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.perfis p
      join public.assinaturas a on a.id = p.assinatura_id
     where p.id = auth.uid()
       and p.status = 'ativo'
       and a.status = 'ativa'
  );
$$;

/** Dono da conta: quem mexe em catalogo, configuracao, equipe e cliente. */
create or replace function public.usuario_assinante()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.perfis p
      join public.assinaturas a on a.id = p.assinatura_id
     where p.id = auth.uid()
       and p.papel = 'assinante'
       and p.status = 'ativo'
       and a.status = 'ativa'
  );
$$;

-- ---------------------------------------------------------------------------
-- Ninguem promove a si mesmo
--
-- A policy de perfis deixa cada um editar a propria linha, o que era inofensivo
-- quando o perfil so tinha nome e WhatsApp. Agora a linha carrega papel, conta e
-- percentual de comissao. RLS nao filtra coluna, entao o portao e um gatilho.
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
  new.comissao_percentual := old.comissao_percentual;
  return new;
end;
$$;

drop trigger if exists perfis_campos_travados on public.perfis;
create trigger perfis_campos_travados
  before update on public.perfis
  for each row execute function public.travar_campos_do_perfil();

-- ---------------------------------------------------------------------------
-- RLS de perfis e assinaturas
-- ---------------------------------------------------------------------------

alter table public.assinaturas enable row level security;

create policy "assinatura propria visivel" on public.assinaturas
  for select to authenticated
  using (public.usuario_admin() or id = public.minha_assinatura());

-- So o admin da plataforma muda status de assinatura. E o unico botao dele.
create policy "admin muda status da assinatura" on public.assinaturas
  for update to authenticated
  using (public.usuario_admin()) with check (public.usuario_admin());

drop policy if exists "perfil proprio visivel" on public.perfis;
drop policy if exists "perfil proprio editavel" on public.perfis;
drop policy if exists "admin gerencia perfis" on public.perfis;

create policy "perfis visiveis" on public.perfis
  for select to authenticated
  using (
    id = auth.uid()
    or public.usuario_admin()
    or (assinatura_id is not null and assinatura_id = public.minha_assinatura())
  );

create policy "perfis editaveis" on public.perfis
  for update to authenticated
  using (
    id = auth.uid()
    or public.usuario_admin()
    or (public.usuario_assinante() and assinatura_id = public.minha_assinatura())
  )
  with check (
    id = auth.uid()
    or public.usuario_admin()
    or (public.usuario_assinante() and assinatura_id = public.minha_assinatura())
  );

create policy "assinante apaga da propria equipe" on public.perfis
  for delete to authenticated
  using (
    public.usuario_admin()
    or (public.usuario_assinante()
        and papel = 'vendedor'
        and assinatura_id = public.minha_assinatura())
  );

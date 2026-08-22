-- Instancias de WhatsApp (uazapi).
--
-- O sistema nasce com uma instancia, mas a ideia e ter varias: no modelo de
-- microsaas, cada assinante se conecta a uma instancia fornecida pela Eucodo.
-- Quando o assinante nao tem instancia, ou parou de pagar, o envio nao quebra:
-- cai no link formatado do WhatsApp, que o vendedor abre e manda na mao.
--
-- O token nao fica em coluna de texto. Ele vive cifrado no Vault do Supabase, e
-- a tabela guarda so o id do segredo. Sao tres camadas, cada uma cobrindo um
-- risco diferente:
--
--   1. Vault: um dump ou backup vazado entrega texto cifrado, nao token util.
--   2. `token_da_instancia` so executa com a chave de servico, ou seja, so
--      dentro da Edge Function. Nem admin logado no painel consegue chamar.
--   3. A tabela nao tem coluna de token, entao nao existe `select *` distraido
--      capaz de expor credencial.
--
-- O que isso NAO protege: quem tiver a chave de servico decifra, porque e ela
-- que precisa decifrar para enviar. Nesse cenario o token da uazapi seria o
-- menor dos problemas.

create extension if not exists supabase_vault with schema vault;

create table public.instancias_whatsapp (
  id uuid primary key default gen_random_uuid(),
  rotulo text not null,
  host text not null check (host ~ '^https://'),
  /** Id do segredo no Vault, nao o token. */
  token_secreto_id uuid not null,
  ativo boolean not null default true,
  observacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create trigger instancias_whatsapp_atualizado_em
  before update on public.instancias_whatsapp
  for each row execute function public.tocar_atualizado_em();

alter table public.instancias_whatsapp enable row level security;

create policy "admin ve instancias" on public.instancias_whatsapp
  for select to authenticated using (public.usuario_admin());

create policy "admin edita instancias" on public.instancias_whatsapp
  for update to authenticated
  using (public.usuario_admin()) with check (public.usuario_admin());

create policy "admin apaga instancias" on public.instancias_whatsapp
  for delete to authenticated using (public.usuario_admin());

-- Nao ha policy de insert: instancia nasce pela funcao abaixo, que e quem sabe
-- guardar o token no Vault.

-- ---------------------------------------------------------------------------
-- Cadastro e leitura do token
-- ---------------------------------------------------------------------------

/**
 * Cria a instancia e guarda o token cifrado, numa transacao so.
 *
 * Aceita chamada sem sessao (SQL Editor, chave de servico) porque e assim que a
 * primeira instancia e cadastrada. Com sessao, exige administrador.
 */
create or replace function public.registrar_instancia_whatsapp(
  p_rotulo text,
  p_host text,
  p_token text,
  p_observacao text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_segredo uuid;
  v_instancia uuid;
begin
  if auth.uid() is not null and not public.usuario_admin() then
    raise exception 'Apenas administrador cadastra instancia';
  end if;

  if coalesce(trim(p_token), '') = '' then
    raise exception 'Token vazio';
  end if;

  v_segredo := vault.create_secret(
    p_token,
    'uazapi_' || replace(gen_random_uuid()::text, '-', ''),
    'Token da instancia uazapi: ' || p_rotulo
  );

  insert into public.instancias_whatsapp (rotulo, host, token_secreto_id, observacao)
  values (p_rotulo, p_host, v_segredo, p_observacao)
  returning id into v_instancia;

  return v_instancia;
end;
$$;

/** Troca o token de uma instancia que ja existe, sem criar segredo orfao. */
create or replace function public.trocar_token_instancia(
  p_instancia_id uuid,
  p_token text
)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_segredo uuid;
begin
  if auth.uid() is not null and not public.usuario_admin() then
    raise exception 'Apenas administrador troca token';
  end if;

  select token_secreto_id into v_segredo
  from public.instancias_whatsapp
  where id = p_instancia_id;

  if v_segredo is null then
    raise exception 'Instancia nao encontrada';
  end if;

  perform vault.update_secret(v_segredo, p_token);
end;
$$;

/**
 * Devolve o token decifrado. So a chave de servico executa, ou seja, so a Edge
 * Function de envio. Esta e a unica porta de saida do token.
 */
create or replace function public.token_da_instancia(p_instancia_id uuid)
returns text
language sql
stable
security definer
set search_path = public, vault
as $$
  select segredo.decrypted_secret
  from public.instancias_whatsapp instancia
  join vault.decrypted_secrets segredo on segredo.id = instancia.token_secreto_id
  where instancia.id = p_instancia_id
    and instancia.ativo;
$$;

revoke execute on function public.token_da_instancia(uuid) from public, anon, authenticated;
grant execute on function public.token_da_instancia(uuid) to service_role;

revoke execute on function public.registrar_instancia_whatsapp(text, text, text, text)
  from public, anon;
revoke execute on function public.trocar_token_instancia(uuid, text) from public, anon;

-- ---------------------------------------------------------------------------
-- Ligacao com a instalacao e registro de como a mensagem saiu
-- ---------------------------------------------------------------------------

-- Qual instancia esta instalacao usa. Nulo significa envio por link.
alter table public.configuracoes
  add column instancia_id uuid references public.instancias_whatsapp (id) on delete set null;

-- Como a mensagem saiu: pela API ou pelo link que o vendedor abriu.
create type public.via_mensagem as enum ('uazapi', 'link');

alter table public.mensagens_whatsapp
  add column via public.via_mensagem not null default 'uazapi';

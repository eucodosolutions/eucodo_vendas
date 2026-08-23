-- A instancia de WhatsApp passa a ser de uma conta so.
--
-- Ate aqui a instancia era cadastrada por SQL e servia a instalacao inteira: a
-- Edge Function de envio, quando a conta nao tinha `instancia_id`, pegava
-- qualquer instancia ativa. Numa instalacao unica isso era conveniencia; em
-- multiassinatura e um vazamento — a mensagem do assinante B sairia pelo
-- WhatsApp do assinante A, e o cliente responderia para o numero errado.
--
-- Agora a instancia nasce pelo painel, em Ajustes: o assinante pede para
-- conectar, a Edge Function cria a instancia no servidor uazapi com o
-- admintoken da plataforma, guarda o token no Vault e amarra a conta. O
-- assinante so escaneia o QR code, e nunca ve token nenhum.

-- De quem e a instancia. Nulo e a instancia legada, cadastrada por SQL antes
-- desta migration, que continua servindo as contas ja ligadas a ela.
alter table public.instancias_whatsapp
  add column assinatura_id uuid references public.assinaturas (id) on delete set null;

-- Uma conta, uma instancia. Sem isto, um clique duplo em "Conectar" deixaria
-- duas instancias pagas de pe para o mesmo assinante, e so uma seria usada.
create unique index instancias_whatsapp_uma_por_conta
  on public.instancias_whatsapp (assinatura_id)
  where assinatura_id is not null;

-- O id que a instancia tem la na uazapi. Nao e usado no envio (quem autentica e
-- o token), mas e o que permite achar a mesma instancia no painel deles quando
-- algo precisa ser investigado na mao.
alter table public.instancias_whatsapp add column id_remoto text;

-- ---------------------------------------------------------------------------
-- Cadastro: agora com dono
-- ---------------------------------------------------------------------------

/**
 * Cria a instancia e guarda o token cifrado, numa transacao so.
 *
 * Aceita chamada sem sessao (SQL Editor, chave de servico) porque e assim que a
 * Edge Function cadastra. Com sessao, exige administrador: nenhum assinante
 * logado registra instancia direto, mesmo sendo a dele.
 */
create or replace function public.registrar_instancia_whatsapp(
  p_rotulo text,
  p_host text,
  p_token text,
  p_observacao text default null,
  p_assinatura_id uuid default null,
  p_id_remoto text default null
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

  insert into public.instancias_whatsapp
    (rotulo, host, token_secreto_id, observacao, assinatura_id, id_remoto)
  values
    (p_rotulo, p_host, v_segredo, p_observacao, p_assinatura_id, p_id_remoto)
  returning id into v_instancia;

  return v_instancia;
end;
$$;

revoke execute on function public.registrar_instancia_whatsapp(text, text, text, text, uuid, text)
  from public, anon;

-- A assinatura da funcao mudou, entao a versao de quatro argumentos ficou para
-- tras. Sai daqui para nao existirem duas portas de cadastro, cada uma com uma
-- regra de dono diferente.
drop function if exists public.registrar_instancia_whatsapp(text, text, text, text);

/**
 * Apaga a instancia e o segredo dela, juntos.
 *
 * Serve para quando a instancia sumiu do lado da uazapi — o plano caiu, ou a
 * instancia gratuita expirou depois de uma hora — e o token guardado aqui nao
 * abre mais nada. Sem isto, o `unique` acima travaria a conta para sempre num
 * token morto: nao daria para criar a instancia nova, e a antiga nao responde.
 *
 * Deletar o segredo do Vault e parte do trabalho. Apagar so a linha deixaria o
 * token cifrado no banco sem nada apontando para ele, e um segredo que ninguem
 * mais sabe de onde veio nunca vai ser apagado por ninguem.
 */
create or replace function public.esquecer_instancia_whatsapp(p_instancia_id uuid)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_segredo uuid;
begin
  if auth.uid() is not null and not public.usuario_admin() then
    raise exception 'Apenas administrador esquece instancia';
  end if;

  select token_secreto_id into v_segredo
  from public.instancias_whatsapp
  where id = p_instancia_id;

  if v_segredo is null then
    return;
  end if;

  delete from public.instancias_whatsapp where id = p_instancia_id;
  delete from vault.secrets where id = v_segredo;
end;
$$;

revoke execute on function public.esquecer_instancia_whatsapp(uuid) from public, anon, authenticated;
grant execute on function public.esquecer_instancia_whatsapp(uuid) to service_role;

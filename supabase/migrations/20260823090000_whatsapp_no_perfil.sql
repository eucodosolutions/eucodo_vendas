-- WhatsApp de quem usa o painel.
--
-- O cadastro passa a coletar o numero. Serve para saber quem e o vendedor por
-- tras de um pedido sem precisar caçar o e-mail, e e o caminho natural para
-- avisar o proprio vendedor de alguma coisa no futuro.
--
-- Fica anulavel: as contas criadas antes desta migration nao tem o dado, e
-- barrar o login delas por isso seria pior que o buraco no cadastro.

alter table public.perfis
  add column whatsapp text;

alter table public.perfis
  add constraint perfis_whatsapp_formato
  check (whatsapp is null or whatsapp ~ '^55[1-9][0-9]9[0-9]{8}$');

-- O gatilho passa a copiar o numero que veio do cadastro.
create or replace function public.criar_perfil_do_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfis (id, nome, email, whatsapp)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)),
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'whatsapp'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- O cliente do vendedor e dele: cadastra, edita e remove.
--
-- Duas coisas travavam a equipe, e as duas vinham do mesmo desenho antigo, de
-- quando cliente era coisa so do dono da conta.
--
--   1. O numero era unico por conta. Como o vendedor nao ve os clientes do
--      assinante, ele digitava um cadastro novo, tomava "ja existe um cliente
--      com esse WhatsApp" e ficava sem saida: nao via o cliente para escolher,
--      e nao conseguia cadastrar.
--   2. Editar e remover eram do assinante. O vendedor errava o nome no
--      cadastro e nao tinha como corrigir o proprio erro.
--
-- A unicidade passa a ser por autor. Um numero pode repetir dentro da conta
-- quando os cadastros sao de pessoas diferentes — sao duas agendas, cada uma
-- com o seu historico — e continua barrado quando e a mesma pessoa cadastrando
-- duas vezes, que e o caso que de fato parte o historico em dois.

-- A restricao velha sai pelo nome que o Postgres deu a ela, procurado pelas
-- colunas. Um `drop constraint if exists` com o nome escrito a mao passaria
-- calado se o nome fosse outro, e o vendedor continuaria barrado sem que nada
-- na esteira acusasse.
do $$
declare
  v_nome text;
begin
  select c.conname
    into v_nome
    from pg_constraint c
   where c.conrelid = 'public.clientes'::regclass
     and c.contype = 'u'
     and (
       select array_agg(a.attname order by a.attname)
         from unnest(c.conkey) as k(attnum)
         join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
     ) = array['assinatura_id', 'whatsapp'];

  if v_nome is not null then
    execute format('alter table public.clientes drop constraint %I', v_nome);
  end if;
end;
$$;

-- Sem NULLS NOT DISTINCT de proposito. `criado_por` so fica nulo quando o
-- perfil de quem cadastrou e apagado, e nesse caso o indice precisa deixar as
-- linhas orfas conviverem: com nulo participando da comparacao, apagar o
-- segundo vendedor levantaria erro de chave duplicada no `on delete set null`.
create unique index if not exists clientes_whatsapp_por_autor
  on public.clientes (assinatura_id, whatsapp, criado_por);

-- ---------------------------------------------------------------------------
-- Quem cadastrou manda no cadastro
--
-- A policy de select nao muda: o vendedor continua vendo so os clientes dele, e
-- o assinante ve os da conta inteira. Por isso a regra de escrita e a mesma dos
-- pedidos — o dono da conta, ou quem criou a linha.
-- ---------------------------------------------------------------------------

drop policy if exists "assinante edita clientes" on public.clientes;
drop policy if exists "assinante apaga clientes" on public.clientes;

create policy "clientes editados por quem cadastrou" on public.clientes
  for update to authenticated
  using (
    public.usuario_ativo()
    and assinatura_id = public.minha_assinatura()
    and (public.usuario_assinante() or criado_por = auth.uid())
  )
  -- O `with check` tambem prende `criado_por`: sem ele o vendedor poderia
  -- passar o cliente para outra pessoa da equipe, ou para o dono da conta, e
  -- perder o proprio cadastro de vista na mesma gravacao.
  with check (
    public.usuario_ativo()
    and assinatura_id = public.minha_assinatura()
    and (public.usuario_assinante() or criado_por = auth.uid())
  );

create policy "clientes apagados por quem cadastrou" on public.clientes
  for delete to authenticated
  using (
    public.usuario_ativo()
    and assinatura_id = public.minha_assinatura()
    and (public.usuario_assinante() or criado_por = auth.uid())
  );

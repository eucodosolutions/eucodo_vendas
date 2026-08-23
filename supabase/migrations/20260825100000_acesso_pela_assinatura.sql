-- ---------------------------------------------------------------------------
-- Quem libera o acesso e a assinatura, nao o perfil
--
-- Existiam dois portoes para a mesma porta: `perfis.status` (pendente, ativo,
-- bloqueado) e `assinaturas.status` (pendente, ativa, suspensa, cancelada). O
-- painel do admin so mexia no segundo, e o primeiro era conferido antes dele:
-- liberar a assinatura nao abria conta nenhuma, e cada conta nova precisava de
-- um UPDATE na mao.
--
-- Um estado que ninguem consegue alterar pela interface nao e um estado, e uma
-- armadilha. `perfis.status` vira `perfis.ativo`, um booleano que nasce
-- verdadeiro e so serve para tirar UMA pessoa do ar sem derrubar a conta dela.
-- Se a conta abre ou nao, quem diz e `assinaturas.status`.
-- ---------------------------------------------------------------------------

alter table public.perfis add column ativo boolean not null default true;

comment on column public.perfis.ativo is
  'Bloqueio individual. A liberacao da conta vem de assinaturas.status.';

-- Quem estava pendente so esperava a assinatura, que continua pendente do
-- mesmo jeito. Bloqueado era decisao sobre a pessoa, e essa se mantem.
update public.perfis set ativo = (status <> 'bloqueado');

-- ---------------------------------------------------------------------------
-- As funcoes das policies passam a ler o booleano
--
-- Sao `language sql` com corpo em $$, que o Postgres nao rastreia como
-- dependencia: o DROP COLUMN la embaixo passaria calado e as funcoes so
-- quebrariam na primeira consulta. Por isso elas vem antes.
-- ---------------------------------------------------------------------------

create or replace function public.usuario_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfis
    where id = auth.uid() and ativo and papel = 'admin'
  );
$$;

/**
 * Pessoa liberada E assinatura em dia.
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
       and p.ativo
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
       and p.ativo
       and a.status = 'ativa'
  );
$$;

-- Ninguem se desbloqueia sozinho: mesma trava de antes, coluna nova.
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
  new.ativo := old.ativo;
  new.assinatura_id := old.assinatura_id;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cadastro: a pessoa nasce liberada, a assinatura nasce pendente
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

    insert into public.perfis (id, nome, email, whatsapp, papel, assinatura_id)
    values (new.id, v_nome, new.email, v_whatsapp, 'vendedor', v_assinatura)
    on conflict (id) do nothing;

    return new;
  end if;

  -- Cadastro pela pagina: assinante novo e conta nova. A conta e que espera
  -- liberacao; a pessoa ja nasce com o acesso dela em ordem.
  insert into public.assinaturas (nome)
  values (coalesce(nullif(trim(new.raw_user_meta_data ->> 'negocio'), ''), v_nome))
  returning id into v_assinatura;

  insert into public.perfis (id, nome, email, whatsapp, papel, assinatura_id)
  values (new.id, v_nome, new.email, v_whatsapp, 'assinante', v_assinatura)
  on conflict (id) do nothing;

  perform public.clonar_catalogo(v_assinatura);

  insert into public.configuracoes (assinatura_id)
  values (v_assinatura)
  on conflict (assinatura_id) do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Agora sim, o estado antigo sai
-- ---------------------------------------------------------------------------

alter table public.perfis drop column status;
drop type public.status_usuario;

-- ---------------------------------------------------------------------------
-- Prazo e dado do produto
--
-- Ate a chegada de `produtos.prazo_entrega_dias`, o prazo era um numero solto
-- na conta e valia para tudo que ela vendia. Hoje cada produto tem o seu, o
-- pedido herda o maior deles pelo gatilho `recalcular_pedido`, e e esse que vai
-- no {prazo} da mensagem. A coluna da conta sobrou como sugestao de formulario,
-- que e exatamente o tipo de dado que envelhece errado.
-- ---------------------------------------------------------------------------

alter table public.configuracoes drop column prazo_producao_dias;

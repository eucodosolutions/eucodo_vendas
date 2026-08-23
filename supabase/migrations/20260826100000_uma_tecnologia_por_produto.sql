-- Uma tecnologia por produto, e o codigo do produto deixa de existir.
--
-- A migration anterior fez o caminho oposto: um produto por tamanho, com cor e
-- tecnologia escolhidas na venda. Na pratica isso nao fecha, porque QR e QR+NFC
-- nao custam o mesmo — e o produto tem preco unico. O jeito de a placa com
-- aproximacao custar mais e ela ser outro produto.
--
-- Decidido pelo Joel em 23/08/2026:
--
--   1. `produto_avaliacao.tecnologias[]` vira `tecnologia`, uma so. A cor
--      continua sendo escolha na venda: nao muda o preco.
--   2. O catalogo de placa passa a ser quatro produtos (A6 e A5, cada um em QR
--      e QR+NFC), e nao mais dois.
--   3. `produtos.codigo` sai. Era um segundo identificador, digitado a mao, que
--      so servia para o nome do arquivo da arte — o id e o nome ja dao conta.

-- ---------------------------------------------------------------------------
-- O codigo sai, o nome passa a ser o identificador visivel
-- ---------------------------------------------------------------------------

-- Nome repetido impediria a restricao de entrar. Desempata pelo mais novo, que
-- e quem tem mais chance de ainda nao ter sido vendido.
update public.produtos p
   set nome = p.nome || ' (' || d.posicao || ')'
  from (
    select id,
           row_number() over (partition by assinatura_id, nome order by criado_em, id) as posicao
      from public.produtos
  ) d
 where d.id = p.id and d.posicao > 1;

-- Derruba junto a unique (assinatura_id, codigo), que era so dele.
alter table public.produtos drop column codigo;

alter table public.produtos add constraint produtos_nome_unico unique (assinatura_id, nome);

-- O retrato do produto no item ja tem `produto_nome`. O codigo carimbado ali
-- apontava para um campo que nao existe mais em lugar nenhum.
alter table public.pedido_itens drop column produto_codigo;

-- ---------------------------------------------------------------------------
-- A placa oferece uma tecnologia, nao um conjunto
-- ---------------------------------------------------------------------------

alter table public.produto_avaliacao add column tecnologia public.tecnologia_arte;

-- Quem oferecia as duas fica com a mais completa: e o preco que estava gravado.
update public.produto_avaliacao
   set tecnologia = case when 'qr_nfc' = any (tecnologias) then 'qr_nfc' else tecnologias[1] end;

alter table public.produto_avaliacao
  alter column tecnologia set not null,
  drop column tecnologias;

-- ---------------------------------------------------------------------------
-- Limpa o catalogo de placa e semeia os quatro
-- ---------------------------------------------------------------------------

-- Placa ja vendida nao pode sair: `pedido_itens.produto_id` e ON DELETE
-- RESTRICT justamente para o historico nao perder o que foi vendido. Ela sai da
-- venda e ganha o nome que explica por que continua na lista.
update public.produtos p
   set ativo = false,
       nome = p.nome || ' (fora de linha)'
 where p.tipo = 'avaliacao'
   and exists (select 1 from public.pedido_itens i where i.produto_id = p.id);

delete from public.produtos p
 where p.tipo = 'avaliacao'
   and not exists (select 1 from public.pedido_itens i where i.produto_id = p.id);

drop function if exists public.clonar_catalogo(uuid);
drop table public.catalogo_modelo;

create table public.catalogo_modelo (
  id uuid primary key default gen_random_uuid(),
  tipo public.tipo_produto not null,
  nome text not null unique,
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
  tecnologia public.tecnologia_arte
);

alter table public.catalogo_modelo enable row level security;
-- Sem policy nenhuma: so a chave de servico e as funcoes SECURITY DEFINER leem.

-- A placa nao tem descricao: quem mostra ao cliente o que ele leva e a arte.
-- Os precos sao os das variantes que existiam antes de o produto virar um so.
insert into public.catalogo_modelo
  (tipo, nome, preco_centavos, ordem, largura_mm, altura_mm, cores, tecnologia)
values
  ('avaliacao', 'Display A6 QR', 3900, 1,
   107, 150, array['branco', 'preto']::public.cor_arte[], 'qr'),
  ('avaliacao', 'Display A6 QR + aproximação', 5900, 2,
   107, 150, array['branco', 'preto']::public.cor_arte[], 'qr_nfc'),
  ('avaliacao', 'Display A5 QR', 5900, 3,
   150, 212, array['branco', 'preto']::public.cor_arte[], 'qr'),
  ('avaliacao', 'Display A5 QR + aproximação', 7900, 4,
   150, 212, array['branco', 'preto']::public.cor_arte[], 'qr_nfc');

/** Copia o catalogo modelo para uma assinatura recem-criada. */
create or replace function public.clonar_catalogo(p_assinatura uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.produtos
    (assinatura_id, tipo, nome, descricao,
     preco_centavos, comissao_percentual, prazo_entrega_dias, ordem)
  select p_assinatura, m.tipo, m.nome, m.descricao,
         m.preco_centavos, m.comissao_percentual, m.prazo_entrega_dias, m.ordem
    from public.catalogo_modelo m
  on conflict (assinatura_id, nome) do nothing;

  insert into public.produto_avaliacao
    (produto_id, assinatura_id, largura_mm, altura_mm,
     margem_seguranca_mm, sangria_mm, dpi, cores, tecnologia)
  select p.id, p_assinatura, m.largura_mm, m.altura_mm,
         m.margem_seguranca_mm, m.sangria_mm, m.dpi, m.cores, m.tecnologia
    from public.catalogo_modelo m
    join public.produtos p
      on p.assinatura_id = p_assinatura and p.nome = m.nome
   where m.tipo = 'avaliacao'
  on conflict (produto_id) do nothing;
end;
$$;

-- As contas que ja existem recebem o catalogo novo agora, e nao no proximo
-- cadastro: sem isso elas ficariam sem placa nenhuma para vender.
select public.clonar_catalogo(a.id) from public.assinaturas a;

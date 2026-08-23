-- O pagamento combinado na venda, separado do pagamento que aconteceu.
--
-- `forma_pagamento` e `pago_em` respondem "como o dinheiro entrou", e a
-- constraint `pago_precisa_de_forma` exige que os dois so existam junto com
-- `pagamento = 'pago'`. Isso esta certo e nao muda aqui.
--
-- O que faltava era o outro lado: o que foi *combinado* no fechamento. Sem
-- lugar para isso, a tela de venda nao teria como perguntar "PIX ou dinheiro" e
-- "paga agora ou na entrega", que e justamente o que decide se a mensagem do
-- WhatsApp sai com a cobranca junto.
--
-- Decidido pelo Joel em 23/08/2026: combinar nao e receber. "Pagar agora" so
-- manda o PIX copia e cola na mensagem; o pedido continua pendente ate alguem
-- apertar "Marcar como pago" na tela do pedido, quando o dinheiro cair de fato.

create type public.momento_pagamento as enum ('agora', 'na_entrega');

alter table public.pedidos
  add column forma_combinada public.forma_pagamento,
  add column momento_pagamento public.momento_pagamento,
  -- O BR Code do pedido, do jeito que foi mandado. E um retrato, como
  -- `produto_nome` no item: ele carrega o total e o codigo daquele fechamento,
  -- e reconstruir depois daria um codigo diferente se a chave PIX da conta
  -- mudar. Nulo em tudo que nao e PIX a vista.
  add column pix_copia_e_cola text;

-- Momento sem forma seria "paga agora" sem dizer como. Os dois andam juntos, ou
-- nenhum dos dois existe — que e o caso dos pedidos abertos antes desta coluna.
alter table public.pedidos add constraint combinado_tem_forma_e_momento check (
  (forma_combinada is null and momento_pagamento is null)
  or (forma_combinada is not null and momento_pagamento is not null)
);

-- ---------------------------------------------------------------------------
-- A mensagem que leva a cobranca junto
-- ---------------------------------------------------------------------------

-- Modelo proprio, e nao um `{pix}` dentro do `pedido_criado`: a variavel vazia
-- deixaria um bloco de cobranca em branco em todo pedido que nao e PIX a vista.
-- O copia e cola vai sozinho na ultima linha porque e assim que o WhatsApp
-- deixa copiar com um toque: qualquer texto na mesma linha vem junto na colagem.
insert into public.modelos_mensagem (chave, descricao, corpo)
values (
  'pedido_criado_pix',
  'Enviada no fechamento quando o cliente vai pagar agora por PIX',
  E'Oi, {nome_negocio}! Aqui é a Eucodo Solutions.\n\nSeu pedido está fechado.\n\n*Pedido {codigo}*\n{itens}\n\nTotal: {total}\nPrazo de entrega: {prazo}\n\nPara confirmar a produção, é só pagar com o PIX copia e cola abaixo. Toque no código para copiar:\n\n{pix}'
)
on conflict (chave) do nothing;

-- ---------------------------------------------------------------------------
-- O PIX da conta, para quem vende
-- ---------------------------------------------------------------------------

-- `configuracoes` so e visivel para o assinante, e isso esta certo: e a tela de
-- Ajustes, onde se troca a chave. Mas quem mais fecha pedido e o vendedor, e sem
-- ler a chave ele mandaria a mensagem sem cobranca nenhuma — a venda da equipe
-- inteira sairia sem PIX, em silencio.
--
-- Abrir a tabela para todo usuario ativo resolveria e traria junto a instancia
-- de WhatsApp da conta, que nao e da conta e sim da plataforma. Entao vai pelo
-- mesmo caminho de `token_da_instancia`: uma funcao que devolve so os tres
-- campos do PIX, e so os da propria assinatura de quem chama.
--
-- Nao ha segredo exposto aqui. A chave PIX e justamente o que o vendedor manda
-- para o cliente pagar; ele so nao pode troca-la, e continua nao podendo.
create or replace function public.pix_da_conta()
returns table (pix_chave text, pix_beneficiario text, pix_cidade text)
language sql
stable
security definer
set search_path = public
as $$
  select c.pix_chave, c.pix_beneficiario, c.pix_cidade
    from public.configuracoes c
   where c.assinatura_id = public.minha_assinatura()
     and public.usuario_ativo();
$$;

revoke all on function public.pix_da_conta() from public;
grant execute on function public.pix_da_conta() to authenticated;

-- A mensagem do fechamento fala do combinado, e assina com quem vendeu.
--
-- Dois problemas viviam no mesmo texto.
--
-- O primeiro era a assinatura: "Aqui e a Eucodo Solutions" estava escrito no
-- corpo do modelo, e os modelos sao da plataforma, nao da conta. Todo assinante
-- se apresentava ao cliente dele como a Eucodo. Agora quem assina e {remetente},
-- que a Edge Function monta a partir de quem fechou o pedido. O assinante e a
-- empresa e assina com as duas coisas — "Joel Bernardo, da Eucodo Solutions".
-- O vendedor assina so com o proprio nome: ele indica e ganha comissao, nao
-- trabalha na empresa do assinante, e apresenta-lo como se trabalhasse faria o
-- cliente cobrar dele prazo, troca e nota. {vendedor} e {empresa} existem
-- soltos tambem, para quem for reescrever o texto.
--
-- O segundo era o fecho. Havia dois modelos para quatro combinados, entao PIX
-- na entrega, dinheiro agora e dinheiro na entrega recebiam todos a mesma
-- frase: "e so acertar o pagamento por aqui". No PIX a vista ela era pior
-- ainda, porque mandava acertar por ali sem mandar o copia e cola junto. Cada
-- combinado passa a ter o seu texto, e o modelo generico fica so como rede de
-- seguranca para o pedido que nao tem combinado nenhum gravado — os fechados
-- antes da coluna existir, e o que entra pelo link publico.

-- O modelo do PIX a vista vira um dos quatro combinados, com nome de combinado.
-- Sai e entra em vez de ser renomeado porque a chave nova precisa existir mesmo
-- se a antiga nunca tiver chegado neste banco; nada aponta para o id da linha,
-- so para a chave.
delete from public.modelos_mensagem where chave = 'pedido_criado_pix';

insert into public.modelos_mensagem (chave, descricao, corpo)
values
  (
    'pedido_criado_pix_agora',
    'Fechamento combinado em PIX, pago na hora: vai com o copia e cola',
    E'Oi, {nome_negocio}! Aqui é {remetente}.\n\nSeu pedido está fechado.\n\n*Pedido {codigo}*\n{itens}\n\nTotal: {total}\nPrazo de entrega: {prazo}\n\nPara confirmar a produção, é só pagar com o PIX copia e cola abaixo. Toque no código para copiar:\n\n{pix}'
  ),
  (
    'pedido_criado_pix_entrega',
    'Fechamento combinado em PIX, pago na entrega',
    E'Oi, {nome_negocio}! Aqui é {remetente}.\n\nSeu pedido está fechado.\n\n*Pedido {codigo}*\n{itens}\n\nTotal: {total}\nPrazo de entrega: {prazo}\n\nCombinamos o pagamento por PIX na entrega. Na hora eu te mando o copia e cola de {total}, já com o valor dentro.'
  ),
  (
    'pedido_criado_dinheiro_agora',
    'Fechamento combinado em dinheiro, acertado na hora',
    E'Oi, {nome_negocio}! Aqui é {remetente}.\n\nSeu pedido está fechado.\n\n*Pedido {codigo}*\n{itens}\n\nTotal: {total}\nPrazo de entrega: {prazo}\n\nCombinamos o pagamento em dinheiro, no fechamento. Assim que eu receber os {total}, seu pedido entra na fila de produção.'
  ),
  (
    'pedido_criado_dinheiro_entrega',
    'Fechamento combinado em dinheiro, acertado na entrega',
    E'Oi, {nome_negocio}! Aqui é {remetente}.\n\nSeu pedido está fechado.\n\n*Pedido {codigo}*\n{itens}\n\nTotal: {total}\nPrazo de entrega: {prazo}\n\nCombinamos o pagamento em dinheiro na entrega. É só me acertar os {total} quando eu chegar com o pedido.'
  )
on conflict (chave) do update
  set descricao = excluded.descricao,
      corpo = excluded.corpo;

update public.modelos_mensagem
   set descricao = 'Fechamento sem combinado gravado: deixa o pagamento para a conversa',
       corpo = E'Oi, {nome_negocio}! Aqui é {remetente}.\n\nSeu pedido está fechado.\n\n*Pedido {codigo}*\n{itens}\n\nTotal: {total}\nPrazo de entrega: {prazo}\n\nPara a gente confirmar a produção, é só acertar o pagamento por aqui.'
 where chave = 'pedido_criado';

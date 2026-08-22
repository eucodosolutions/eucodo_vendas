-- Acentuacao nas mensagens que o cliente recebe.
--
-- Os modelos entraram sem acento na carga inicial. Texto sem acento no
-- WhatsApp de um cliente passa impressao de mensagem automatica malfeita, que e
-- exatamente o contrario do que o display esta vendendo.
--
-- De quebra, a mensagem de pedido criado prometia um codigo PIX que ainda nao
-- existe. Enquanto o PIX nao entra, ela combina o pagamento pela conversa.

update public.modelos_mensagem
set corpo = E'Oi, {nome_negocio}! Aqui é a Eucodo Solutions.\n\nSua arte já está pronta, e é ela mesma que vai no display.\n\n*Pedido {codigo}*\nDisplay {tamanho} {cor}, {tecnologia}\nQuantidade: {quantidade}\nTotal: {total}\n\nPara a gente confirmar a produção, é só acertar o pagamento por aqui.'
where chave = 'pedido_criado';

update public.modelos_mensagem
set corpo = E'Boa notícia, {nome_negocio}! Seu pedido {codigo} entrou em produção.\n\nAssim que estiver pronto eu te aviso por aqui.'
where chave = 'status_em_producao';

update public.modelos_mensagem
set corpo = E'{nome_negocio}, seu display ficou pronto!\n\nPedido {codigo}. Já pode combinar comigo a entrega.'
where chave = 'status_pronto';

update public.modelos_mensagem
set corpo = E'Pedido {codigo} entregue, {nome_negocio}!\n\nDeixe o display em um ponto onde o cliente já esteja parado, o balcão do caixa costuma ser o melhor lugar. Qualquer coisa é só chamar aqui.'
where chave = 'status_entregue';

update public.modelos_mensagem
set corpo = E'{nome_negocio}, o pedido {codigo} foi cancelado.\n\nSe foi engano ou se quiser retomar, é só me responder por aqui.'
where chave = 'status_cancelado';

update public.modelos_mensagem
set corpo = E'Pagamento do pedido {codigo} confirmado, {nome_negocio}. Obrigado!\n\nJá coloquei na fila de produção.'
where chave = 'pagamento_confirmado';

update public.modelos_mensagem
set descricao = case chave
  when 'pedido_criado' then 'Enviada junto com a arte, no momento em que o pedido é fechado'
  when 'status_em_producao' then 'Enviada quando o pedido entra em produção'
  when 'status_pronto' then 'Enviada quando a produção termina'
  when 'status_entregue' then 'Enviada na entrega'
  when 'status_cancelado' then 'Enviada quando o pedido é cancelado'
  when 'pagamento_confirmado' then 'Enviada quando o pagamento é baixado no painel'
  else descricao
end
where chave in (
  'pedido_criado',
  'status_em_producao',
  'status_pronto',
  'status_entregue',
  'status_cancelado',
  'pagamento_confirmado'
);

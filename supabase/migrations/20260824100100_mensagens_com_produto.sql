-- As mensagens deixam de falar so de placa.
--
-- O modelo de pedido criado descrevia o item na unha, com {tamanho} {cor} e
-- {tecnologia}. Num pedido de camiseta essas tres chaves saem vazias e a frase
-- vira "Display  , ". A lista {itens}, que ja existe e ja monta uma linha por
-- item, resolve os dois tipos de uma vez.
--
-- Entra tambem {prazo}, que agora e dado do produto e nao mais um numero solto
-- na configuracao da conta.

update public.modelos_mensagem
set corpo = E'Oi, {nome_negocio}! Aqui é a Eucodo Solutions.\n\nSeu pedido está fechado.\n\n*Pedido {codigo}*\n{itens}\n\nTotal: {total}\nPrazo de entrega: {prazo}\n\nPara a gente confirmar a produção, é só acertar o pagamento por aqui.'
where chave = 'pedido_criado';

update public.modelos_mensagem
set corpo = E'Boa notícia, {nome_negocio}! Seu pedido {codigo} entrou em produção.\n\nPrazo de entrega: {prazo}. Assim que estiver pronto eu te aviso por aqui.'
where chave = 'status_em_producao';

update public.modelos_mensagem
set corpo = E'{nome_negocio}, seu pedido {codigo} ficou pronto!\n\nJá pode combinar comigo a entrega.'
where chave = 'status_pronto';

update public.modelos_mensagem
set corpo = E'Pedido {codigo} entregue, {nome_negocio}!\n\nQualquer coisa é só chamar aqui.'
where chave = 'status_entregue';

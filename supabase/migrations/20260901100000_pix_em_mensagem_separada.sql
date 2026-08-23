-- O PIX copia e cola sai sozinho, na propria mensagem.
--
-- O codigo ia no fim do resumo, e o resumo viaja como legenda da primeira arte.
-- Legenda de imagem no WhatsApp nao tem "copiar": para pagar, o cliente tinha
-- que selecionar a mao os oitenta e poucos caracteres do BR Code no meio de um
-- paragrafo, sem sobrar espaco nem faltar caractere. Errar ali nao da erro
-- visivel — da "chave invalida" no app do banco, e a venda esfria.
--
-- A Edge Function passa a tirar o `{pix}` do corpo e manda-lo depois das artes,
-- numa mensagem de texto que so tem o codigo. Assim o cliente segura a ultima
-- mensagem da conversa, copia e cola no banco. O `{pix}` continua no fim do
-- modelo de proposito: e por ele que a funcao sabe que este texto pede
-- cobranca, e e ele que cai no lugar certo quando o envio vai por link manual,
-- onde o vendedor manda uma mensagem so.
--
-- O texto tambem para de prometer o que a legenda nao entrega ("toque no codigo
-- para copiar") e passa a dizer onde o codigo esta.

update public.modelos_mensagem
   set corpo = E'Oi, {nome_negocio}! Aqui é {remetente}.\n\nSeu pedido está fechado.\n\n*Pedido {codigo}*\n{itens}\n\nTotal: {total}\nPrazo de entrega: {prazo}\n\nPara confirmar a produção, é só pagar o PIX de {total}. O código copia e cola vem logo abaixo, sozinho numa mensagem, para você copiar de uma vez.\n\n{pix}'
 where chave = 'pedido_criado_pix_agora';

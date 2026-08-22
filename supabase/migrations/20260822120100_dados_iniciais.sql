-- Dados iniciais: os dois tamanhos confirmados pelo Joel em 22/08/2026, as oito
-- variantes e os modelos de mensagem do WhatsApp.
--
-- Os precos aqui sao provisorios e existem para o sistema funcionar de ponta a
-- ponta. Todos sao editaveis no painel, sem deploy.

insert into public.tamanhos (codigo, rotulo, largura_mm, altura_mm, margem_seguranca_mm, sangria_mm, dpi, ordem)
values
  ('A6', 'A6', 107, 150, 7, 0, 300, 1),
  ('A5', 'A5', 150, 212, 7, 0, 300, 2)
on conflict (codigo) do nothing;

-- Os literais da lista abaixo chegam como text: o cast para o enum e explicito.
insert into public.variantes (tamanho_id, cor, tecnologia, preco_centavos)
select t.id, v.cor::public.cor_arte, v.tecnologia::public.tecnologia_arte, v.preco
from public.tamanhos t
join (
  values
    ('A6', 'branco', 'qr', 3900),
    ('A6', 'preto', 'qr', 3900),
    ('A6', 'branco', 'qr_nfc', 5900),
    ('A6', 'preto', 'qr_nfc', 5900),
    ('A5', 'branco', 'qr', 5900),
    ('A5', 'preto', 'qr', 5900),
    ('A5', 'branco', 'qr_nfc', 7900),
    ('A5', 'preto', 'qr_nfc', 7900)
) as v (codigo, cor, tecnologia, preco)
  on v.codigo = t.codigo
on conflict (tamanho_id, cor, tecnologia) do nothing;

-- Modelos de mensagem. As chaves entre chaves sao trocadas no envio.
insert into public.modelos_mensagem (chave, descricao, corpo)
values
  (
    'pedido_criado',
    'Enviada junto com a arte, no momento em que o pedido e fechado',
    E'Oi, {nome_negocio}! Aqui e a Eucodo Solutions.\n\nSua arte ja esta pronta, e ela mesma que vai no display.\n\n*Pedido {codigo}*\nDisplay {tamanho} {cor}, {tecnologia}\nQuantidade: {quantidade}\nTotal: {total}\n\nPara confirmar a producao, e so pagar por PIX com o codigo abaixo. Assim que cair, seu pedido entra na fila.'
  ),
  (
    'status_em_producao',
    'Enviada quando o pedido entra em producao',
    E'Boa noticia, {nome_negocio}! Seu pedido {codigo} entrou em producao.\n\nAssim que estiver pronto eu te aviso por aqui.'
  ),
  (
    'status_pronto',
    'Enviada quando a producao termina',
    E'{nome_negocio}, seu display ficou pronto!\n\nPedido {codigo}. Ja pode combinar comigo a entrega.'
  ),
  (
    'status_entregue',
    'Enviada na entrega',
    E'Pedido {codigo} entregue, {nome_negocio}!\n\nDeixe o display em um ponto onde o cliente ja esteja parado, o balcao do caixa costuma ser o melhor lugar. Qualquer coisa e so chamar aqui.'
  ),
  (
    'status_cancelado',
    'Enviada quando o pedido e cancelado',
    E'{nome_negocio}, o pedido {codigo} foi cancelado.\n\nSe foi engano ou se quiser retomar, e so me responder por aqui.'
  ),
  (
    'pagamento_confirmado',
    'Enviada quando o pagamento e baixado no painel',
    E'Pagamento do pedido {codigo} confirmado, {nome_negocio}. Obrigado!\n\nJa coloquei na fila de producao.'
  )
on conflict (chave) do nothing;

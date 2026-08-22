# Eucodo Vendas, plano de construcao

Sistema de venda de displays de acrilico para avaliacao no Google Meu Negocio.
Objetivo numero um: fechar a venda em menos de um minuto, do "quanto custa" ate
o cliente com a arte e o PIX na mao.

## Decisoes tomadas (22/08/2026)

1. Painel interno de venda rapida + link publico de pedido.
2. As artes sao criadas por mim, em SVG vetorial, revisadas em canvas visual.
3. Link de avaliacao: busca por nome via Google Places, com colar link como alternativa.
4. PIX copia e cola vai junto na mensagem do WhatsApp, baixa manual no painel.

## Stack

Mesma dos outros sistemas da casa (OnPulso, Somma360):

- Next.js 16 (App Router) + TypeScript + Tailwind 4 + shadcn/ui
- Supabase: Postgres, Auth, Storage (artes), RLS
- Geracao de arte: SVG montado no servidor, rasterizado com `@resvg/resvg-js`
  e convertido para JPG com `sharp`
- QR code: `qrcode` (saida SVG, vetorial, sem perda na impressao)
- PIX: `pix-utils` (mesma lib do OnPulso)
- WhatsApp: uazapi (REST, texto + midia)
- Deploy: Vercel

## Catalogo (8 SKUs)

| Tamanho | Arte | Tecnologia |
|---|---|---|
| A5 (148x210mm) | Preta / Branca | QR / QR + NFC |
| A6 (105x148mm) | Preta / Branca | QR / QR + NFC |

Precos ficam em tabela no banco, editaveis pelo painel (nao chumbados no codigo).

## Fluxo de venda rapida (tela `/vender`, otimizada para celular)

1. Cards de preco na tela, viradas para o cliente ver.
2. Toque escolhe tamanho, cor e tecnologia.
3. Campo unico "nome do negocio": busca no Google Places, retorna o
   estabelecimento e ja monta o link de avaliacao.
4. WhatsApp do cliente.
5. "Gerar pedido": preview da arte renderizada na hora.
6. "Enviar no WhatsApp": cliente recebe mockup + resumo do pedido + PIX copia e cola.

## Fluxo publico (link para mandar antes da conversa)

- `/catalogo`: apresentacao do produto, precos, mockups.
- `/pedido`: mesmo formulario, o proprio cliente preenche. Cai no painel como
  pedido novo e dispara a mesma mensagem.

## Painel

- Lista de pedidos com filtro por status, pagamento e periodo.
- Detalhe do pedido: dados, preview da arte, download do JPG em alta (300 DPI)
  e do PDF com sangria para grafica.
- Mudanca de status notifica o cliente no WhatsApp (mensagem por status, editavel).
- Cancelar pedido (com motivo) e marcar como pago (forma + data).
- Log de eventos e de mensagens enviadas por pedido.

## Status do pedido

`novo` -> `em_producao` -> `pronto` -> `entregue`, e `cancelado` a partir de qualquer um.
Pagamento em trilha separada: `pendente` / `pago`, com forma (pix, dinheiro, cartao, transferencia).

## Modelo de dados

- `product_variants`: tamanho, cor, tecnologia, preco, ativo
- `orders`: codigo, negocio, whatsapp, link de avaliacao, place_id, variante,
  quantidade, valor, status, pagamento, forma, pago_em, arquivos da arte, motivo do cancelamento
- `order_events`: auditoria de mudanca de status
- `whatsapp_messages`: log de envio (payload, resposta da uazapi, erro)
- `message_templates`: texto por evento, editavel no painel
- `settings`: chave PIX, dados do recebedor, prazo de producao

## Auth

Supabase Auth com e-mail e senha: login, criar conta, esqueci a senha, redefinir senha, 404.
Conta nova entra como `pendente` e so acessa o painel depois de aprovada, para o link de
cadastro nao virar porta aberta.

## Geracao da arte

Template SVG parametrizado por variante. Entram: nome do negocio (com ajuste
automatico de corpo quando o nome e longo), QR code vetorial do link de avaliacao,
selo de aproximacao no modelo NFC.

Saidas por pedido:
- JPG 300 DPI para producao (A5: 1748x2480 px, A6: 1240x1748 px)
- PDF com 3mm de sangria para grafica
- PNG leve de preview para o WhatsApp

Tudo salvo no Supabase Storage, em bucket privado com URL assinada.

## Fases

1. Scaffold, Supabase, migrations, auth completo, 404
2. Motor de arte (SVG, QR, rasterizacao) e as 4 variacoes visuais aprovadas
3. Tela de venda rapida + Places + criacao de pedido
4. uazapi: envio da arte, do resumo e do PIX
5. Painel: lista, detalhe, downloads, status com notificacao, cancelar, baixar pagamento
6. Link publico de catalogo e pedido

## Pendencias com o Joel

- Tabela de precos dos 8 SKUs
- Chave PIX + nome e cidade do recebedor
- uazapi: host do servidor e token da instancia
- Google Places API key
- Prazo de producao e regra de entrega/frete
- Confirmar se a arte ocupa o A5/A6 inteiro ou tem area util menor no display

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

## Produto tem tipo

O cadastro e de **produto**, e o tipo e escolhido na criacao:

- **Placa de avaliacao**: medidas (largura, altura, margem, sangria, DPI), quais
  cores e quais tecnologias o produto oferece. A arte sai sozinha no fechamento
  do pedido. Sementes: A6 107 x 150 mm e A5 150 x 212 mm, margem de 7 mm, 300 DPI.
- **Padrao**: descricao, foto, valor, comissao e prazo. E onde entra tudo o mais
  que o assinante vende, de camiseta a servico.

Os dois tem codigo, nome, valor, percentual de comissao, prazo de entrega e o
interruptor de ativo na venda. Cadastrar formato novo nao exige deploy: as
medidas sao dado, e o motor de arte calcula o desenho por proporcao da largura
util, entao qualquer formato de acrilico funciona.

Preco e **unico por produto**. Cor e tecnologia sao escolha na venda e nao mexem
no valor: cobrar diferente por NFC e cadastrar dois produtos.

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

- Navegacao: barra lateral no desktop, barra inferior no celular, menu por papel.
- Pedidos em quadro por status, com arrastar e soltar no desktop; no celular,
  a mesma lista com abas de status e o botao de avancar no cartao. A lista
  cronologica continua disponivel em `?vista=lista`.
- Detalhe do pedido: dados, preview da arte, download do JPG em alta (300 DPI)
  e do PDF com sangria para grafica.
- Mudanca de status notifica o cliente no WhatsApp (mensagem por status, editavel),
  com confirmacao antes e opcao de nao avisar.
- Cancelar pedido (com motivo) e marcar como pago (forma + data).
- Log de eventos e de mensagens enviadas por pedido.

## Status do pedido

`novo` -> `em_producao` -> `pronto` -> `entregue`, e `cancelado` a partir de qualquer um.
Da para pular etapa (venda entregue na hora) e para voltar (conserto de engano);
o que nao anda mais e pedido cancelado. As regras moram em `lib/pedidos/fluxo.ts`
e a action confere antes de gravar.
Voltar nao avisa o cliente por padrao, e todo movimento tem interruptor de aviso.
Pagamento em trilha separada: `pendente` / `pago`, com forma (pix, dinheiro, cartao, transferencia).

## Modelo de dados

Tudo em portugues, e quase tudo com dono (`assinatura_id`):

- `assinaturas`: a conta. Nome e status (pendente, ativa, suspensa, cancelada)
- `perfis`: pessoa, papel, conta, senha provisoria e `ativo` (bloqueio individual;
  quem libera a conta e o status da assinatura)
- `catalogo_modelo`: semente sem dono, copiada para cada conta nova
- `produtos`: o catalogo da conta (tipo, codigo, nome, descricao, foto, preco,
  comissao, prazo)
- `produto_avaliacao`: so o que a placa tem (medidas, cores e tecnologias oferecidas)
- `clientes`: nome e WhatsApp obrigatorios, unico por autor dentro da conta
- `pedidos`: cliente, total, status, pagamento, comissao, prazo, origem
- `pedido_itens`: produto e retrato dele no dia da venda, comissao da linha,
  quantidade e, so na placa, negocio impresso, link de avaliacao e arquivos da arte
- `pedido_eventos`: auditoria de mudanca de status
- `mensagens_whatsapp`: log de envio (corpo, resposta da uazapi, erro)
- `modelos_mensagem`: texto por evento. **Ainda global**, e a proxima divida do microsaas
- `configuracoes`: uma linha por conta, com PIX e instancia de WhatsApp. O prazo saiu
  daqui: e dado do produto, e o pedido herda o maior entre os itens
- `instancias_whatsapp`: fornecidas pela plataforma, uma por conta, token cifrado no Vault

## Auth e papeis

Supabase Auth com e-mail e senha: login, criar conta, esqueci a senha, redefinir senha, 404.

Tres papeis, e dois paineis:

- **Admin** e a plataforma. Ve tudo para operar o painel dela (`/admin`), e nao vende.
  Dashboard com assinantes por status, volume do mes contra o anterior, ranking e atividade
  recente; e a tela de assinantes, onde o status de cada conta muda.
- **Assinante** e quem se cadastra pela pagina. Dono da conta: catalogo, clientes, equipe e
  configuracoes sao dele. A conta dele nasce `pendente` e so entra quando o admin libera a
  assinatura em `/admin/assinantes` — nao existe um segundo estado no perfil para liberar
  junto, justamente porque um deles sempre ficava para tras.
- **Vendedor** e criado pelo assinante em `/equipe`, ja preso a assinatura dele. Ve so os
  pedidos que abriu e os clientes que cadastrou, e nao entra em Produtos nem em Ajustes.
  Os clientes dele sao dele: cadastra, edita e remove.
  A senha vem gerada pela Edge Function `equipe`, aparece uma vez para o dono copiar e
  mandar no WhatsApp, e a troca e obrigatoria no primeiro acesso.

Suspender uma assinatura derruba a equipe junto: `usuario_ativo()` exige `perfis.ativo`
**e** assinatura ativa, entao a regra mora num lugar so. Do lado da aplicacao, quem
responde e `motivoDoBloqueio()`, usada tanto pelo login quanto pelo layout do painel —
antes eram duas copias, e elas discordavam.

## Assinaturas e dados por conta

`assinaturas` e a conta. `perfis.assinatura_id` amarra as pessoas a ela, e `produtos`,
`produto_avaliacao`, `clientes`, `pedidos` e `configuracoes` carregam o dono. O gatilho de cadastro
cria a assinatura, clona o catalogo modelo (`catalogo_modelo` + `clonar_catalogo`) e abre a
linha de configuracao, tudo na mesma transacao do `auth.users`.

O caminho da arte no Storage comeca pela conta: `{assinatura_id}/{codigo}/{item}/arte.jpg`,
e a policy do bucket compara a primeira pasta com `minha_assinatura()`.

## Clientes

Cadastro proprio, com nome e WhatsApp obrigatorios, unico por
`(assinatura_id, whatsapp, criado_por)`. Sao duas agendas debaixo da mesma conta: o vendedor
cadastra, edita, remove e enxerga so os dele; o dono da conta ve todos e mexe em todos, com
etiqueta de autor no que veio da equipe.

A unicidade e por autor porque o vendedor nao ve os clientes do assinante: fosse por conta, o
numero que o dono ja tem cadastrado barraria o cadastro do vendedor sem lhe dar nenhuma saida
— ele nao veria o cliente para escolher, e nao conseguiria criar. Repetido para a mesma
pessoa continua barrado, que e o caso que de fato parte o historico de compra em dois.

## Negocios

Cliente e quem paga; **negocio** e o lugar que recebe a placa. Sao dois cadastros porque nascem
em momentos diferentes: o negocio entra no planejamento da rota, quando ainda nao existe
conversa com ninguem e portanto nao existe WhatsApp, e o cliente so aparece na hora de fechar
o pedido. Um cliente pode levar placa de dois negocios, e um negocio pode ser pago por gente
diferente em duas compras.

A identidade da linha e o `link_avaliacao`, e nao o `google_place_id`: quem gerencia o proprio
perfil chega com o link na mao e nunca passa pela busca. A unicidade e por autor
(`assinatura_id, link_avaliacao, criado_por`), pelo mesmo motivo da de cliente, e a
visibilidade tambem — o vendedor manda no que cadastrou, o dono da conta manda na conta
inteira.

O negocio entra por tres caminhos, que sao as tres abas do `BuscaDeNegocio`: escolher um
cadastrado, pesquisar no Google Places ou colar o link. Os dois ultimos cadastram na hora,
por `garantirNegocio`, no momento em que o item entra no carrinho — e nao no fechamento. A
visita que nao vira venda continua valendo: e a metade da rota do dia seguinte.

`pedido_itens.negocio_id` e ponteiro de historico, com `ON DELETE SET NULL`. O que foi
impresso continua carimbado no proprio item (`nome_negocio`, `link_avaliacao`), como
`produto_nome` e o preco: renomear ou apagar o negocio nao mexe em placa ja vendida. E por
isso que o nome do cadastro e o nome impresso sao campos separados — o primeiro e como a
pessoa organiza a agenda dela, o segundo e o que vai no acrilico.

## Carrinho

Um pedido tem itens. `pedidos` guarda cliente, total, status, comissao e prazo; `pedido_itens`
guarda o retrato do produto vendido e, quando e placa, o negocio impresso, o link de avaliacao
e a arte. E o caso que motivou tudo: duas placas no mesmo pedido, para empresas diferentes —
e agora tambem uma placa e uma camiseta na mesma venda.

O carrinho vive no `localStorage`, nao no banco: ele dura dois minutos no meio de uma
conversa de venda. O total e a comissao sao conta do gatilho `recalcular_pedido`, nunca da
aplicacao.

Ele se abre de dois lugares, e nenhum deles cobre a vitrine: no computador, um botao no
cabecalho da tela de venda, que fica preso no topo enquanto a grade rola; no celular, o botao
redondo levantado no meio da barra de baixo, que so aparece com item dentro. Por isso o
estado da gaveta mora num store de modulo (`src/lib/carrinho/gaveta.ts`): quem abre no
celular e a navegacao, que vive fora da tela de venda.

## Comissao

Percentual **por produto** (`produtos.comissao_percentual`), e nao mais por vendedor: um
item de margem alta pode pagar mais que outro no mesmo pedido. O gatilho
`carimbar_item_do_pedido` grava o percentual e o valor em cada linha no momento da venda, e
`recalcular_pedido` soma em `pedidos.comissao_centavos`. Mexer no percentual em Produtos vale
para as proximas vendas e nao alcanca pedido fechado.

Comissao so existe quando quem abriu o pedido e vendedor: pedido do proprio assinante, ou
vindo do link publico, rende zero.

Tres bolsos na tela: **a caminho** (fechado, nao pago), **a receber** (pago, comissao
em aberto) e **acertado** (`pedidos.comissao_paga_em`). O dono acerta na tela de equipe.

## PWA

`src/app/manifest.ts`, icones gerados por `npm run icones`, service worker minimo em
`public/sw.js` e o convite para instalar em `src/components/convite-para-instalar.tsx`.
Barra lateral no desktop, barra inferior no celular, com a area segura do iPhone.

## Geracao da arte

So o tipo `avaliacao` gera arte. Produto padrao mostra a foto que o assinante subiu.

Template SVG parametrizado pelo produto e pela combinacao escolhida na venda. Entram:
nome do negocio (com ajuste
automatico de corpo quando o nome e longo), QR code vetorial do link de avaliacao,
selo de aproximacao no modelo NFC.

Saidas por pedido:
- JPG 300 DPI para producao (A5: 1748x2480 px, A6: 1240x1748 px)
- PDF com 3mm de sangria para grafica
- PNG leve de preview para o WhatsApp

Tudo salvo no Supabase Storage, em bucket privado com URL assinada.

## Fases

1. [feito] Scaffold, migrations, auth completo, 404
2. [feito] Motor de arte (SVG, QR, rasterizacao), medidas confirmadas em 22/08/2026
3. [feito] Tela de venda rapida e criacao de pedido com arte gerada e guardada
4. [feito] Painel: lista, detalhe, download do JPG, status, cancelar, baixar pagamento
5. uazapi: envio da arte, do resumo e das notificacoes de status
6. PIX copia e cola na mesma mensagem
7. Busca do link de avaliacao pelo nome (Google Places)
8. Link publico de catalogo e de pedido
9. [feito] Ajustes: produtos, precos, PIX e prazo, por assinante
10. [feito] Equipe: vendedor cadastrado pelo assinante, e acerto de comissao
11. [feito] Multiassinatura: papeis, painel admin, clientes, carrinho, navegacao e PWA
12. [feito] Produto por tipo: placa de avaliacao e padrao, comissao e prazo no produto
13. [feito] Acesso so pela assinatura, Produtos em aba propria e cadastro em popup
14. [feito] WhatsApp em Ajustes: o assinante conecta por QR code, e a instancia e da conta
15. [feito] Cliente do vendedor: cadastro por autor, edicao e remocao de quem cadastrou

Passo a passo para subir o ambiente: `docs/CONFIGURACAO.md`.

## Pendencias com o Joel

- Preco de cada produto (agora e um por produto, e nao um por SKU)
- Chave PIX + nome e cidade do recebedor
- uazapi: host do servidor e **admintoken** da conta, para a plataforma criar a
  instancia de cada assinante (vao em Edge Functions, Secrets, e nao no `.env`)
- Google Places API key
- Regra de entrega e frete (o prazo ja e por produto)
- Confirmar a medida do A6: os px enviados (1216,54 x 1724,41) equivalem a
  103 x 146 mm, e nao aos 107 x 150 mm informados. O A5 ja fechou em 150 x 212 mm.
- Confirmar se a arte ocupa o A5/A6 inteiro ou tem area util menor no display

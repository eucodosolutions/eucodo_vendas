import type { StatusPedido } from "@/types/database";

/**
 * As regras de como um pedido anda, num lugar so.
 *
 * Antes a ordem dos status existia apenas no cliente, numa constante da tela de
 * detalhe: o servidor aceitava qualquer pulo, inclusive para tras. Enquanto a
 * unica forma de mudar status era um botao "marcar como o proximo", isso era
 * teorico. Com o quadro de arrastar virou possivel de verdade, entao a regra
 * desceu para ca e a action passou a conferir antes de gravar.
 *
 * O arquivo e neutro de proposito — nada de `server-only` — porque as duas
 * pontas precisam da mesma verdade: a action valida com ela, e o quadro decide
 * com ela quais colunas acendem quando um cartao esta no ar.
 */

/** A ordem que o quadro mostra, da esquerda para a direita. */
export const COLUNAS_DO_QUADRO: StatusPedido[] = [
  "novo",
  "em_producao",
  "pronto",
  "entregue",
  "cancelado",
];

/**
 * Cancelado nao fica na fila com os outros: nao e uma etapa mais adiantada que
 * "entregue", e sim a saida lateral. Por isso o numero solto la em cima — ele
 * so precisa nunca ser confundido com um passo do caminho normal.
 */
const ORDEM: Record<StatusPedido, number> = {
  novo: 0,
  em_producao: 1,
  pronto: 2,
  entregue: 3,
  cancelado: 99,
};

/**
 * Vale mover?
 *
 * Pular etapa vale: venda entregue na hora do balcao sai de "novo" direto para
 * "entregue", e obrigar a passar por producao e por pronto seriam duas
 * mensagens que o cliente nao precisava receber. Voltar tambem vale, porque
 * engano acontece e o conserto nao pode exigir abrir chamado.
 *
 * O que nao vale e mexer em pedido cancelado, e soltar o cartao na coluna onde
 * ele ja estava.
 */
export function podeMover(de: StatusPedido, para: StatusPedido): boolean {
  if (de === para) return false;
  if (de === "cancelado") return false;
  return true;
}

/**
 * Esta indo para tras?
 *
 * Serve para decidir o padrao do aviso ao cliente. Voltar e conserto de engano,
 * nao novidade: quem marcou "pronto" sem querer e desfaz nao quer que o cliente
 * receba "seu pedido esta em producao" logo depois de ter recebido "seu pedido
 * esta pronto".
 *
 * Cancelamento fica fora da conta — ele tem tela propria, com motivo
 * obrigatorio e o seu proprio interruptor de aviso.
 */
export function ehVoltar(de: StatusPedido, para: StatusPedido): boolean {
  if (de === "cancelado" || para === "cancelado") return false;
  return ORDEM[para] < ORDEM[de];
}

/**
 * O passo seguinte no caminho normal.
 *
 * E o que o botao de avancar oferece, na tela do pedido e no cartao. O quadro
 * deixa pular e voltar arrastando, mas o botao continua sugerindo so um destino:
 * uma lista de cinco botoes em cada cartao nao caberia, e na duvida o proximo
 * passo e o que a pessoa quer em quase toda vez.
 */
export const PROXIMO_STATUS: Record<StatusPedido, StatusPedido[]> = {
  novo: ["em_producao"],
  em_producao: ["pronto"],
  pronto: ["entregue"],
  entregue: [],
  cancelado: [],
};

/**
 * Esse destino tem mensagem para o cliente?
 *
 * "Novo" nao tem: e o estado em que o pedido nasce, e o cliente ja recebeu o
 * fechamento com a arte na hora da venda. So aparece como destino quando alguem
 * volta um pedido para o comeco, e ai nao ha novidade nenhuma para contar.
 *
 * O mapa de qual mensagem sai para cada status mora na action, que e quem
 * conversa com o WhatsApp; aqui fica so o "sai ou nao sai", que a tela precisa
 * saber para nao oferecer um interruptor que nao liga nada.
 */
export function temMensagemParaOCliente(status: StatusPedido): boolean {
  return status !== "novo";
}

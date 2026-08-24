import type { Cliente, Pedido, PedidoItem } from "@/types/database";

/**
 * O pedido do jeito que a listagem precisa dele.
 *
 * Mora aqui, e nao na pagina, porque agora tres arquivos falam do mesmo
 * registro: a pagina que busca, o quadro que agrupa por status e o cartao que
 * desenha. Um `Pick` copiado nos tres divergiria na primeira coluna nova.
 */
export type LinhaPedido = Pick<
  Pedido,
  | "id"
  | "codigo"
  | "total_centavos"
  | "status"
  | "pagamento"
  | "comissao_centavos"
  | "comissao_paga_em"
  | "criado_em"
> & {
  clientes: Pick<Cliente, "nome" | "whatsapp"> | null;
  pedido_itens: Array<Pick<PedidoItem, "nome_negocio" | "produto_nome" | "quantidade">>;
};

/** As colunas que a consulta precisa trazer para preencher `LinhaPedido`. */
export const COLUNAS_DA_LINHA =
  "id, codigo, total_centavos, status, pagamento, comissao_centavos, comissao_paga_em, criado_em, clientes (nome, whatsapp), pedido_itens (nome_negocio, produto_nome, quantidade)";

/**
 * Uma linha para o pedido inteiro.
 *
 * Com um item so, o que interessa e de qual negocio e a placa — e, quando nao e
 * placa, o nome do produto. Com varios, a lista nao caberia e vale a contagem.
 */
export function resumirItens(
  itens: Array<Pick<PedidoItem, "nome_negocio" | "produto_nome" | "quantidade">>,
): string {
  if (itens.length === 0) return "Sem itens";

  const pecas = itens.reduce((soma, item) => soma + item.quantidade, 0);

  if (itens.length === 1) {
    const item = itens[0];
    const nome = item.nome_negocio || item.produto_nome;
    return item.quantidade > 1 ? `${nome}, ${item.quantidade} unidades` : nome;
  }

  return `${itens.length} itens, ${pecas} peças`;
}

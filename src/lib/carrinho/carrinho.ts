import type { CorArte, TipoProduto } from "@/types/database";

/**
 * Uma linha do carrinho: um produto, na quantidade pedida.
 *
 * Os quatro campos do fim so existem no tipo `avaliacao`. A empresa mora no
 * item, e nao no pedido, porque o caso comum e justamente esse: o cliente na
 * frente pede duas placas, uma para cada negocio dele.
 *
 * A tecnologia nao esta aqui: ela e do produto, e nao da linha. Guardar uma
 * copia dela no navegador so criaria a chance de o carrinho discordar do
 * catalogo enquanto o cliente decide.
 */
export type ItemDoCarrinho = {
  /** Id local, so para o React ter chave estavel na lista. */
  chave: string;
  produtoId: string;
  tipo: TipoProduto;
  produtoNome: string;
  precoUnitarioCentavos: number;
  quantidade: number;
  cor?: CorArte;
  /**
   * O cadastro de onde esta placa saiu. Ja existe no banco quando chega aqui:
   * o negocio nasce ao adicionar o item, e nao no fechamento, para a visita
   * que nao virar venda continuar valendo como prospeccao no dia seguinte.
   */
  negocioId?: string;
  nomeNegocio?: string;
  linkAvaliacao?: string;
  placeId?: string;
};

/**
 * A chave carrega versao desde que o item deixou de ser sempre uma placa.
 *
 * Um carrinho gravado no formato antigo, com `varianteId`, quebraria a venda no
 * primeiro fechamento depois do deploy. Trocar a chave e o jeito barato de o
 * navegador simplesmente comecar vazio. A v3 foi a saida do `produtoCodigo` e
 * da `tecnologia` da linha; a v4 e a entrada do `negocioId`, sem o qual a placa
 * fecharia sem cadastro de negocio nenhum.
 */
export const CHAVE_CARRINHO = "eucodo:carrinho:v4";

export function totalDoCarrinho(itens: ItemDoCarrinho[]): number {
  return itens.reduce((soma, item) => soma + item.precoUnitarioCentavos * item.quantidade, 0);
}

export function pecasDoCarrinho(itens: ItemDoCarrinho[]): number {
  return itens.reduce((soma, item) => soma + item.quantidade, 0);
}

export function lerCarrinhoGuardado(): ItemDoCarrinho[] {
  try {
    const bruto = localStorage.getItem(CHAVE_CARRINHO);
    if (!bruto) return [];

    const lido: unknown = JSON.parse(bruto);
    return Array.isArray(lido) ? (lido as ItemDoCarrinho[]) : [];
  } catch {
    // Navegador sem armazenamento, ou conteudo estragado: comeca vazio.
    return [];
  }
}

export function guardarCarrinho(itens: ItemDoCarrinho[]) {
  try {
    localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(itens));
  } catch {
    // O carrinho continua valendo em memoria; so nao sobrevive ao recarregar.
  }
}

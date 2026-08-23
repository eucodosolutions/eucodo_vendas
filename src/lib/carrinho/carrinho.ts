import type { CorArte, TecnologiaArte, TipoProduto } from "@/types/database";

/**
 * Uma linha do carrinho: um produto, na quantidade pedida.
 *
 * Os quatro campos do fim so existem no tipo `avaliacao`. A empresa mora no
 * item, e nao no pedido, porque o caso comum e justamente esse: o cliente na
 * frente pede duas placas, uma para cada negocio dele.
 */
export type ItemDoCarrinho = {
  /** Id local, so para o React ter chave estavel na lista. */
  chave: string;
  produtoId: string;
  tipo: TipoProduto;
  produtoCodigo: string;
  produtoNome: string;
  precoUnitarioCentavos: number;
  quantidade: number;
  cor?: CorArte;
  tecnologia?: TecnologiaArte;
  nomeNegocio?: string;
  linkAvaliacao?: string;
  placeId?: string;
};

/**
 * A chave carrega versao desde que o item deixou de ser sempre uma placa.
 *
 * Um carrinho gravado no formato antigo, com `varianteId`, quebraria a venda no
 * primeiro fechamento depois do deploy. Trocar a chave e o jeito barato de o
 * navegador simplesmente comecar vazio.
 */
export const CHAVE_CARRINHO = "eucodo:carrinho:v2";

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

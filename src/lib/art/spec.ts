import type { Produto, ProdutoAvaliacao } from "@/types/database";
import type { ArtSpec } from "./types";

/**
 * Traduz o produto de avaliacao do banco para o formato que o motor de arte
 * entende. E o unico ponto onde as duas representacoes se encontram, entao
 * cadastrar um produto novo no painel basta para a arte sair no formato novo.
 */
export function specDoProduto(
  produto: Pick<Produto, "nome">,
  medidas: Pick<
    ProdutoAvaliacao,
    "largura_mm" | "altura_mm" | "margem_seguranca_mm" | "sangria_mm" | "dpi"
  >,
): ArtSpec {
  return {
    label: produto.nome,
    widthMm: Number(medidas.largura_mm),
    heightMm: Number(medidas.altura_mm),
    safeMarginMm: Number(medidas.margem_seguranca_mm),
    bleedMm: Number(medidas.sangria_mm),
    dpi: medidas.dpi,
  };
}

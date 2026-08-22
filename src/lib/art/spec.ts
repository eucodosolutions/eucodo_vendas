import type { Tamanho } from "@/types/database";
import type { ArtSpec } from "./types";

/**
 * Traduz o registro de tamanho do banco para o formato que o motor de arte
 * entende. E o unico ponto onde as duas representacoes se encontram, entao
 * cadastrar um tamanho novo no painel basta para a arte sair no formato novo.
 */
export function specDoTamanho(tamanho: Pick<
  Tamanho,
  "codigo" | "rotulo" | "largura_mm" | "altura_mm" | "margem_seguranca_mm" | "sangria_mm" | "dpi"
>): ArtSpec {
  return {
    code: tamanho.codigo,
    label: tamanho.rotulo,
    widthMm: Number(tamanho.largura_mm),
    heightMm: Number(tamanho.altura_mm),
    safeMarginMm: Number(tamanho.margem_seguranca_mm),
    bleedMm: Number(tamanho.sangria_mm),
    dpi: tamanho.dpi,
  };
}

import type { CorArte, TecnologiaArte, TipoProduto } from "@/types/database";

/**
 * Os eixos da placa de avaliacao, num lugar so.
 *
 * Estavam chumbados em dois arquivos, o formulario de Ajustes e a tela de
 * venda, e as duas listas ja tinham comecado a divergir na ordem. O produto
 * escolhe quais desses valores ele oferece; estas constantes so dizem quais
 * existem.
 */
export const CORES: CorArte[] = ["branco", "preto"];
export const TECNOLOGIAS: TecnologiaArte[] = ["qr_nfc", "qr"];

export const TIPOS: TipoProduto[] = ["avaliacao", "padrao"];

/** O que muda de campo em campo conforme o tipo, para a tela nao adivinhar. */
export const DETALHE_DO_TIPO: Record<TipoProduto, string> = {
  avaliacao: "Medidas, cores e QR. A arte sai pronta.",
  padrao: "Descrição, foto e valor.",
};

export function ehAvaliacao(tipo: TipoProduto): boolean {
  return tipo === "avaliacao";
}

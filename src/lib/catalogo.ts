import type { ArtSpec } from "@/lib/art/types";
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
export const TECNOLOGIAS: TecnologiaArte[] = ["qr", "qr_nfc"];

export const TIPOS: TipoProduto[] = ["avaliacao", "padrao"];

/** O que muda de campo em campo conforme o tipo, para a tela nao adivinhar. */
export const DETALHE_DO_TIPO: Record<TipoProduto, string> = {
  avaliacao: "Medidas, cores e QR. A arte sai pronta.",
  padrao: "Descrição, foto e valor.",
};

export function ehAvaliacao(tipo: TipoProduto): boolean {
  return tipo === "avaliacao";
}

/**
 * Os tamanhos que a Eucodo corta, com as medidas do acrilico que ela usa.
 *
 * Quem escolhe A6 ou A5 nao digita medida nenhuma: o cadastro copia daqui. Sao
 * as medidas da placa, e nao as do papel — por isso 107x150 e nao 105x148.
 */
export type TamanhoDePlaca = "a6" | "a5" | "personalizado";

export const TAMANHOS = {
  a6: { rotulo: "A6", largura_mm: 107, altura_mm: 150 },
  a5: { rotulo: "A5", largura_mm: 150, altura_mm: 212 },
} as const satisfies Record<string, { rotulo: string; largura_mm: number; altura_mm: number }>;

/**
 * O acabamento que vale para tudo que a gente corta.
 *
 * Fica fora da tela quando o tamanho e nosso, e so aparece em Personalizado:
 * sao numeros de grafica, e nao decisao de quem esta cadastrando um produto.
 */
export const ACABAMENTO_PADRAO = {
  margem_seguranca_mm: 7,
  sangria_mm: 0,
  dpi: 300,
} as const;

/**
 * As medidas de um tamanho nosso no formato que o motor de arte entende.
 *
 * Serve aos scripts de previa e aprovacao da arte, que desenham sem passar pelo
 * banco. O produto de verdade sempre monta o spec a partir do que esta gravado
 * nele, em `specDoProduto`: uma placa personalizada nao tem constante nenhuma.
 */
export function specDoTamanho(tamanho: keyof typeof TAMANHOS): ArtSpec {
  const { rotulo, largura_mm, altura_mm } = TAMANHOS[tamanho];

  return {
    label: rotulo,
    widthMm: largura_mm,
    heightMm: altura_mm,
    safeMarginMm: ACABAMENTO_PADRAO.margem_seguranca_mm,
    bleedMm: ACABAMENTO_PADRAO.sangria_mm,
    dpi: ACABAMENTO_PADRAO.dpi,
  };
}

/**
 * De volta ao tamanho a partir das medidas gravadas.
 *
 * O tamanho nao e coluna no banco: guardar "a5" ao lado de 150x212 seria a
 * mesma informacao em dois lugares, livre para divergir no dia em que a placa
 * A5 mudar de medida. Quem abre um produto ja salvo descobre o tamanho pela
 * medida, que e o dado de verdade.
 */
export function tamanhoDasMedidas(largura: number, altura: number): TamanhoDePlaca {
  const encontrado = (Object.keys(TAMANHOS) as Array<keyof typeof TAMANHOS>).find(
    (chave) =>
      Number(TAMANHOS[chave].largura_mm) === Number(largura) &&
      Number(TAMANHOS[chave].altura_mm) === Number(altura),
  );

  return encontrado ?? "personalizado";
}

import { apelidoDeArquivo } from "@/lib/formato";
import type { ArtInput, ArtSpec } from "@/lib/art/types";
import type { CorArte, TecnologiaArte } from "@/types/database";

/**
 * O contrato entre a bancada de teste e a rota que rasteriza o arquivo.
 *
 * Mora aqui, e nao em cada um dos dois lados, porque a tela monta a query e a
 * rota le a mesma query: separados, o dia em que a arte ganhar um campo novo
 * seria o dia em que a previa e o download passariam a mostrar coisas
 * diferentes, sem erro nenhum aparecer.
 *
 * TS puro de proposito — este arquivo entra no bundle do navegador junto com a
 * tela, e a conferencia com zod fica do lado de la, na rota.
 */
export type ParametrosDaArte = {
  nome: string;
  link: string;
  cor: CorArte;
  tec: TecnologiaArte;
  larguraMm: number;
  alturaMm: number;
  margemMm: number;
  sangriaMm: number;
  dpi: number;
  /** Nome do modelo, so para o `label` do spec e o nome do arquivo. */
  rotulo: string;
};

/**
 * O teto de cada medida.
 *
 * A rota rasteriza o que a query mandar, e `mmToPx` cresce com a area: 600 mm a
 * 600 DPI ja e um PNG de mais de 200 megapixels dentro do resvg. Sao numeros de
 * bancada, generosos para qualquer display que a Eucodo corte, e baixos o
 * bastante para uma URL editada na mao nao derrubar o servidor.
 */
export const LIMITES = {
  larguraMm: { min: 20, max: 600 },
  alturaMm: { min: 20, max: 600 },
  margemMm: { min: 0, max: 100 },
  sangriaMm: { min: 0, max: 20 },
  dpi: { min: 72, max: 600 },
} as const;

/**
 * O que a peca mostra enquanto os campos estao vazios.
 *
 * Os mesmos da vitrine de `/vender`. O link precisa existir porque o gerador de
 * QR nao aceita texto vazio, e a tela desenha desde o primeiro render — antes
 * de a pessoa digitar qualquer coisa.
 */
export const NEGOCIO_PADRAO = "Seu negócio";
export const LINK_PADRAO = "https://maps.google.com";

export function specDosParametros(p: ParametrosDaArte): ArtSpec {
  return {
    label: p.rotulo,
    widthMm: p.larguraMm,
    heightMm: p.alturaMm,
    safeMarginMm: p.margemMm,
    bleedMm: p.sangriaMm,
    dpi: p.dpi,
  };
}

export function entradaDosParametros(p: ParametrosDaArte): ArtInput {
  return {
    spec: specDosParametros(p),
    color: p.cor,
    tech: p.tec,
    businessName: p.nome.trim() || NEGOCIO_PADRAO,
    reviewUrl: p.link.trim() || LINK_PADRAO,
  };
}

export type FormatoDaArte = "jpg" | "svg";

/** O link de download de um jeito so, para os dois botoes e para a rota. */
export function paraQuery(p: ParametrosDaArte, formato: FormatoDaArte): string {
  const query = new URLSearchParams({
    nome: p.nome,
    link: p.link,
    cor: p.cor,
    tec: p.tec,
    largura: String(p.larguraMm),
    altura: String(p.alturaMm),
    margem: String(p.margemMm),
    sangria: String(p.sangriaMm),
    dpi: String(p.dpi),
    rotulo: p.rotulo,
    formato,
  });

  return `/gerador/arte?${query.toString()}`;
}

/**
 * O nome do arquivo que cai na pasta de downloads.
 *
 * Leva o negocio, a medida, a cor e a tecnologia: numa bancada saem varias
 * versoes seguidas da mesma peca, e `arte.jpg`, `arte (1).jpg` nao diz qual e
 * qual.
 */
export function nomeDoArquivo(p: ParametrosDaArte, formato: FormatoDaArte): string {
  const negocio = apelidoDeArquivo(p.nome.trim() || NEGOCIO_PADRAO);
  const medida = `${p.larguraMm}x${p.alturaMm}mm`;

  return `arte-${negocio}-${medida}-${p.cor}-${p.tec}.${formato}`;
}

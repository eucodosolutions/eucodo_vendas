import { qrGroup } from "./qr";
import { escapeXml, fitText, type FittedText } from "./text";
import { GOOGLE, GOOGLE_WORDMARK, THEMES, type Theme } from "./theme";
import type { ArtInput, ArtSpec } from "./types";

/**
 * O desenho e calculado a partir das medidas do tamanho, nao de um canvas fixo.
 * A unidade interna e o decimo de milimetro, entao o mesmo codigo serve A5, A6
 * e qualquer tamanho novo que for cadastrado no painel.
 */
const U = 10;

const FONT_STACK = "Poppins, Inter, 'Segoe UI', Arial, sans-serif";

const STAR_PATH =
  "M12 .6l3.67 7.43 8.33 1.15-6.07 5.83 1.48 8.28L12 19.77l-7.41 3.52 1.48-8.28L0 9.18l8.33-1.15z";

/**
 * Proporcoes do desenho. As que terminam em OfH sao fracao da altura da peca,
 * o resto e fracao da largura util (largura menos as duas margens).
 */
const R = {
  /** Corpo padrao do nome, calibrado por "Restaurante Sabor da Terra Nordestina". */
  nameFont: 0.1024,
  nameFontMin: 0.055,
  nameLineHeight: 1.12,
  /** Vao entre os tres blocos. O maximo evita buraco no meio da peca. */
  gapMax: 0.07,
  gapMin: 0.035,
  starSize: 0.0714,
  starGap: 0.0143,
  ctaFont: 0.0667,
  ctaBaseline: 0.1548,
  wordmarkFont: 0.1452,
  wordmarkBaseline: 0.3095,
  /** Altura do grupo estrelas + chamada + letreiro, tratado como um bloco so. */
  groupHeight: 0.3452,
  panelHeightOfH: 0.4286,
  stripeHeightOfH: 0.0438,
  stripeGapOfH: 0.0382,
  panelRx: 0.0524,
  panelStroke: 0.0143,
  cardPadding: 0.0286,
  cardGap: 0.019,
  cardRx: 0.0333,
  cardStroke: 0.0024,
  labelFont: 0.0524,
  labelBaseline: 0.0905,
  singlePanelWidth: 0.781,
  qrDual: 0.419,
  qrDualTop: 0.1452,
  qrSingle: 0.5048,
  qrSingleTop: 0.1381,
  phoneWidth: 0.2,
  phoneHeight: 0.319,
} as const;

type Layout = {
  spec: ArtSpec;
  width: number;
  height: number;
  margin: number;
  bleed: number;
  /** Largura util, entre as margens de seguranca. */
  contentWidth: number;
  stripeHeight: number;
  panelHeight: number;
  /** Faixa vertical onde a composicao pode viver. */
  spanTop: number;
  spanBottom: number;
};

/** Posicoes verticais dos tres blocos, ja resolvidas para este nome. */
type Rhythm = {
  nameTop: number;
  groupTop: number;
  panelTop: number;
  panelBottom: number;
};

function layoutFor(spec: ArtSpec): Layout {
  const width = spec.widthMm * U;
  const height = spec.heightMm * U;
  const margin = spec.safeMarginMm * U;
  const stripeHeight = height * R.stripeHeightOfH;

  return {
    spec,
    width,
    height,
    margin,
    bleed: spec.bleedMm * U,
    contentWidth: width - margin * 2,
    stripeHeight,
    panelHeight: height * R.panelHeightOfH,
    spanTop: margin,
    spanBottom: height - stripeHeight - height * R.stripeGapOfH,
  };
}

/**
 * Distribui nome, grupo do Google e quadro na vertical.
 *
 * O vao entre os blocos e sempre igual em cima e embaixo do grupo, e tem um
 * teto: quando sobra espaco, a sobra vai para as pontas, empurrando o titulo
 * para baixo e subindo o quadro, em vez de abrir um buraco no centro da peca.
 */
function rhythmFor(layout: Layout, name: FittedText): Rhythm {
  const { contentWidth, spanTop, spanBottom, panelHeight } = layout;

  const nameHeight = name.lines.length * name.lineHeight;
  const groupHeight = contentWidth * R.groupHeight;
  const free = spanBottom - spanTop - nameHeight - groupHeight - panelHeight;

  const gap = clamp(free / 2, contentWidth * R.gapMin, contentWidth * R.gapMax);
  const slack = Math.max(0, free - gap * 2) / 2;

  const nameTop = spanTop + slack;
  const groupTop = nameTop + nameHeight + gap;
  const panelTop = groupTop + groupHeight + gap;

  return { nameTop, groupTop, panelTop, panelBottom: panelTop + panelHeight };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

type BuildOptions = {
  /** Canto arredondado, usado so na previa. A arte de impressao sai reta. */
  cornerRadius?: number;
  /** Desenha a margem de seguranca por cima, para conferencia visual. */
  showSafeArea?: boolean;
  /**
   * Familia da fonte do desenho.
   *
   * O padrao e a pilha por nome, que e o que o rasterizador entende. A previa
   * que vai inline no HTML passa "inherit": assim ela usa a Poppins que a
   * pagina ja carregou, em vez de cair na fonte do sistema e sair com um
   * desenho diferente do que vai ser impresso.
   */
  fontFamily?: string;
};

export function buildDisplaySvg(input: ArtInput, options: BuildOptions = {}): string {
  const { cornerRadius = 0, showSafeArea = false, fontFamily = FONT_STACK } = options;
  const layout = layoutFor(input.spec);
  const theme = THEMES[input.color];
  const { width, height, bleed } = layout;

  const name = fitName(layout, input.businessName);
  const rhythm = rhythmFor(layout, name);

  const parts: string[] = [
    background(layout, theme.background, cornerRadius),
    nameBlock(layout, rhythm, name, theme.name),
    ...middleGroup(layout, rhythm, theme.subtitle),
    input.tech === "qr_nfc"
      ? dualPanel(layout, rhythm, input, theme)
      : singlePanel(layout, rhythm, input, theme),
    bottomStripe(layout, cornerRadius),
  ];

  if (showSafeArea) parts.push(safeAreaGuide(layout));

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-bleed} ${-bleed} ${round(width + bleed * 2)} ${round(height + bleed * 2)}" width="${round(width + bleed * 2)}" height="${round(height + bleed * 2)}">`,
    defs(),
    `<g font-family="${fontFamily}">`,
    parts.join(""),
    "</g>",
    "</svg>",
  ].join("");
}

function defs(): string {
  return [
    "<defs>",
    '<linearGradient id="googleBorder" x1="0" y1="0" x2="1" y2="1">',
    `<stop offset="0" stop-color="${GOOGLE.blue}"/>`,
    `<stop offset="0.34" stop-color="${GOOGLE.green}"/>`,
    `<stop offset="0.67" stop-color="${GOOGLE.yellow}"/>`,
    `<stop offset="1" stop-color="${GOOGLE.red}"/>`,
    "</linearGradient>",
    "</defs>",
  ].join("");
}

function background(layout: Layout, color: string, cornerRadius: number): string {
  const { width, height, bleed } = layout;
  return `<rect x="${-bleed}" y="${-bleed}" width="${round(width + bleed * 2)}" height="${round(height + bleed * 2)}" fill="${color}"${
    cornerRadius ? ` rx="${cornerRadius}"` : ""
  }/>`;
}

/**
 * O corpo do nome e fixo no padrao e so diminui quando o nome nao cabe, para
 * nome curto nao virar um letreiro gigante.
 */
function fitName(layout: Layout, name: string): FittedText {
  const { contentWidth, spanTop, spanBottom, panelHeight } = layout;

  return fitText(name.trim() || "Seu negocio", {
    maxWidth: contentWidth,
    maxHeight: spanBottom - spanTop - panelHeight - contentWidth * R.groupHeight,
    maxFontSize: contentWidth * R.nameFont,
    minFontSize: contentWidth * R.nameFontMin,
    maxLines: 2,
    lineHeightRatio: R.nameLineHeight,
  });
}

/** Nome do negocio no lugar onde normalmente fica o logo do Google. */
function nameBlock(layout: Layout, rhythm: Rhythm, name: FittedText, color: string): string {
  const centerX = layout.width / 2;
  const firstBaseline = rhythm.nameTop + name.fontSize * 0.76;

  const lines = name.lines
    .map(
      (line, index) =>
        `<tspan x="${round(centerX)}" y="${round(firstBaseline + index * name.lineHeight)}">${escapeXml(line)}</tspan>`,
    )
    .join("");

  return `<text text-anchor="middle" font-size="${round(name.fontSize)}" font-weight="700" fill="${color}" letter-spacing="${round(-name.fontSize * 0.007)}">${lines}</text>`;
}

/**
 * Estrelas, "Nos avalie no" e o letreiro Google formam um bloco unico, que fica
 * a mesma distancia do nome acima e do quadro abaixo.
 */
function middleGroup(layout: Layout, rhythm: Rhythm, subtitleColor: string): string[] {
  const { contentWidth, width } = layout;
  const top = rhythm.groupTop;
  const centerX = width / 2;

  const starSize = contentWidth * R.starSize;
  const starGap = contentWidth * R.starGap;
  const starsX = centerX - (starSize * 5 + starGap * 4) / 2;
  const starScale = starSize / 24;

  const stars = Array.from({ length: 5 }, (_, index) => {
    const x = starsX + index * (starSize + starGap);
    return `<g transform="translate(${round(x)} ${round(top)}) scale(${round(starScale, 4)})"><path d="${STAR_PATH}" fill="${GOOGLE.yellow}"/></g>`;
  }).join("");

  const wordmarkFont = contentWidth * R.wordmarkFont;
  const letters = GOOGLE_WORDMARK.map(
    ([letter, color]) => `<tspan fill="${color}">${letter}</tspan>`,
  ).join("");

  return [
    stars,
    `<text x="${round(centerX)}" y="${round(top + contentWidth * R.ctaBaseline)}" text-anchor="middle" font-size="${round(contentWidth * R.ctaFont)}" font-weight="500" fill="${subtitleColor}">Nos avalie no</text>`,
    `<text x="${round(centerX)}" y="${round(top + contentWidth * R.wordmarkBaseline)}" text-anchor="middle" font-size="${round(wordmarkFont)}" font-weight="600" letter-spacing="${round(-wordmarkFont * 0.025)}">${letters}</text>`,
  ];
}

function panelFrame(layout: Layout, rhythm: Rhythm, x: number, w: number, theme: Theme): string {
  const { contentWidth } = layout;
  return `<rect x="${round(x)}" y="${round(rhythm.panelTop)}" width="${round(w)}" height="${round(layout.panelHeight)}" rx="${round(contentWidth * R.panelRx)}" fill="${theme.panelFill}" stroke="url(#googleBorder)" stroke-width="${round(contentWidth * R.panelStroke)}"/>`;
}

function card(layout: Layout, x: number, y: number, w: number, h: number, theme: Theme): string {
  const { contentWidth } = layout;
  return `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" rx="${round(contentWidth * R.cardRx)}" fill="${theme.cardFill}" stroke="${theme.cardStroke}" stroke-width="${round(contentWidth * R.cardStroke)}"/>`;
}

function cardLabel(layout: Layout, cx: number, y: number, text: string, color: string): string {
  return `<text x="${round(cx)}" y="${round(y)}" text-anchor="middle" font-size="${round(layout.contentWidth * R.labelFont)}" font-weight="500" fill="${color}">${escapeXml(text)}</text>`;
}

/** Modelo QR + NFC: dois cartoes lado a lado, escanear e aproximar. */
function dualPanel(layout: Layout, rhythm: Rhythm, input: ArtInput, theme: Theme): string {
  const { contentWidth, margin, panelHeight } = layout;
  const padding = contentWidth * R.cardPadding;
  const gap = contentWidth * R.cardGap;

  const innerY = rhythm.panelTop + padding;
  const innerH = panelHeight - padding * 2;
  const cardW = (contentWidth - padding * 2 - gap) / 2;
  const leftX = margin + padding;
  const rightX = leftX + cardW + gap;

  const qrSize = contentWidth * R.qrDual;

  return [
    panelFrame(layout, rhythm, margin, contentWidth, theme),
    card(layout, leftX, innerY, cardW, innerH, theme),
    card(layout, rightX, innerY, cardW, innerH, theme),
    cardLabel(layout, leftX + cardW / 2, innerY + contentWidth * R.labelBaseline, "Escaneie", theme.cardLabel),
    cardLabel(layout, rightX + cardW / 2, innerY + contentWidth * R.labelBaseline, "Aproxime", theme.cardLabel),
    qrGroup(input.reviewUrl, {
      x: leftX + (cardW - qrSize) / 2,
      y: innerY + contentWidth * R.qrDualTop,
      size: qrSize,
    }),
    nfcIcon(layout, rightX + cardW / 2, innerY + innerH / 2 + contentWidth * 0.05, theme.nfcStroke),
  ].join("");
}

/** Modelo so QR: um cartao unico e mais estreito, com o codigo maior. */
function singlePanel(layout: Layout, rhythm: Rhythm, input: ArtInput, theme: Theme): string {
  const { contentWidth, width, panelHeight } = layout;
  const padding = contentWidth * R.cardPadding;
  const panelW = contentWidth * R.singlePanelWidth;
  const panelX = width / 2 - panelW / 2;

  const innerY = rhythm.panelTop + padding;
  const innerH = panelHeight - padding * 2;
  const cardW = panelW - padding * 2;
  const cardX = panelX + padding;

  const qrSize = contentWidth * R.qrSingle;

  return [
    panelFrame(layout, rhythm, panelX, panelW, theme),
    card(layout, cardX, innerY, cardW, innerH, theme),
    cardLabel(layout, cardX + cardW / 2, innerY + contentWidth * R.labelBaseline, "Escaneie e avalie", theme.cardLabel),
    qrGroup(input.reviewUrl, {
      x: cardX + (cardW - qrSize) / 2,
      y: innerY + contentWidth * R.qrSingleTop,
      size: qrSize,
    }),
  ].join("");
}

/** Celular com as ondas de aproximacao, o mesmo simbolo do cartao NFC. */
function nfcIcon(layout: Layout, cx: number, cy: number, color: string): string {
  const { contentWidth } = layout;
  const phoneW = contentWidth * R.phoneWidth;
  const phoneH = contentWidth * R.phoneHeight;
  const stroke = contentWidth * 0.0107;
  const phoneX = cx - phoneW / 2 - contentWidth * 0.036;
  const phoneY = cy - phoneH / 2;

  const waves = [0.045, 0.076, 0.107]
    .map((ratio) => {
      const radius = contentWidth * ratio;
      const originX = phoneX + phoneW + contentWidth * 0.017;
      const start = polar(originX, cy, radius, -52);
      const end = polar(originX, cy, radius, 52);
      return `<path d="M${start.x} ${start.y} A${round(radius)} ${round(radius)} 0 0 1 ${end.x} ${end.y}" fill="none" stroke="${color}" stroke-width="${round(stroke)}" stroke-linecap="round"/>`;
    })
    .join("");

  return [
    `<rect x="${round(phoneX)}" y="${round(phoneY)}" width="${round(phoneW)}" height="${round(phoneH)}" rx="${round(contentWidth * 0.026)}" fill="none" stroke="${color}" stroke-width="${round(stroke)}"/>`,
    `<rect x="${round(phoneX + phoneW / 2 - contentWidth * 0.031)}" y="${round(phoneY + contentWidth * 0.024)}" width="${round(contentWidth * 0.062)}" height="${round(contentWidth * 0.0095)}" rx="${round(contentWidth * 0.005)}" fill="${color}"/>`,
    `<text x="${round(phoneX + phoneW / 2)}" y="${round(cy + contentWidth * 0.019)}" text-anchor="middle" font-size="${round(contentWidth * 0.05)}" font-weight="600" fill="${color}">NFC</text>`,
    waves,
  ].join("");
}

function polar(cx: number, cy: number, radius: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: round(cx + radius * Math.cos(radians)),
    y: round(cy + radius * Math.sin(radians)),
  };
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Faixa de cores no rodape, a assinatura visual do cartao. Sai sangrada. */
function bottomStripe(layout: Layout, cornerRadius: number): string {
  const { width, height, bleed, stripeHeight } = layout;
  const y = height - stripeHeight;
  const blockW = (width + bleed * 2) / 4;
  const colors = [GOOGLE.blue, GOOGLE.red, GOOGLE.yellow, GOOGLE.green];

  const blocks = colors
    .map(
      (color, index) =>
        `<rect x="${round(-bleed + index * blockW)}" y="${round(y)}" width="${round(blockW)}" height="${round(stripeHeight + bleed)}" fill="${color}"/>`,
    )
    .join("");

  if (!cornerRadius) return blocks;

  // Na previa a faixa acompanha o canto arredondado do cartao.
  return [
    `<defs><clipPath id="stripeClip"><rect x="0" y="0" width="${round(width)}" height="${round(height)}" rx="${cornerRadius}"/></clipPath></defs>`,
    `<g clip-path="url(#stripeClip)">${blocks}</g>`,
  ].join("");
}

/** Guia de conferencia: mostra ate onde o conteudo pode chegar. */
function safeAreaGuide(layout: Layout): string {
  const { margin, width, height } = layout;
  return `<rect x="${round(margin)}" y="${round(margin)}" width="${round(width - margin * 2)}" height="${round(height - margin * 2)}" fill="none" stroke="#EA4335" stroke-width="2" stroke-dasharray="12 8" opacity="0.7"/>`;
}

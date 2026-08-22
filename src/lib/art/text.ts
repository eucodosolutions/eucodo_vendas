/**
 * Medicao aproximada de largura de texto, em "em" (fracao do corpo da fonte).
 * Serve para escolher o corpo e quebrar as linhas do nome do negocio sem
 * depender do navegador. Os valores sao calibrados para a Poppins SemiBold.
 *
 * Quando o motor de rasterizacao entrar, esta funcao pode ser trocada por
 * medicao exata via opentype.js sem mudar quem a consome.
 */
const NARROW = new Set(["i", "l", "j", "t", "f", "r", "I", "|", ".", ",", ":", ";", "'", "!"]);
const WIDE = new Set(["m", "w", "M", "W", "@"]);

export function measureEm(text: string): number {
  let total = 0;
  for (const char of text) {
    if (char === " ") total += 0.27;
    else if (NARROW.has(char)) total += 0.33;
    else if (WIDE.has(char)) total += 0.92;
    else if (char >= "A" && char <= "Z") total += 0.69;
    else if (char >= "0" && char <= "9") total += 0.61;
    else total += 0.58;
  }
  // Folga de seguranca, a medicao real varia com kerning.
  return total * 1.02;
}

export function measure(text: string, fontSize: number): number {
  return measureEm(text) * fontSize;
}

export type FittedText = {
  lines: string[];
  fontSize: number;
  lineHeight: number;
};

type FitOptions = {
  maxWidth: number;
  maxHeight: number;
  maxFontSize: number;
  minFontSize: number;
  maxLines: number;
  lineHeightRatio?: number;
};

function wrap(text: string, fontSize: number, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate, fontSize) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Escolhe o maior corpo em que o texto cabe na caixa dada, quebrando em
 * palavras. Se nem no menor corpo couber, corta a ultima linha com reticencias.
 */
export function fitText(text: string, options: FitOptions): FittedText {
  const {
    maxWidth,
    maxHeight,
    maxFontSize,
    minFontSize,
    maxLines,
    lineHeightRatio = 1.12,
  } = options;

  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 2) {
    const lines = wrap(text, fontSize, maxWidth);
    const lineHeight = fontSize * lineHeightRatio;
    const fits =
      lines.length <= maxLines &&
      lines.every((line) => measure(line, fontSize) <= maxWidth) &&
      lines.length * lineHeight <= maxHeight;

    if (fits) return { lines, fontSize, lineHeight };
  }

  // Ultimo recurso: corpo minimo, corta o excedente.
  const fontSize = minFontSize;
  const lines = wrap(text, fontSize, maxWidth).slice(0, maxLines);
  const last = lines[lines.length - 1];
  if (last && measure(last, fontSize) > maxWidth) {
    let truncated = last;
    while (truncated.length > 1 && measure(`${truncated}...`, fontSize) > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    lines[lines.length - 1] = `${truncated.trimEnd()}...`;
  }
  return { lines, fontSize, lineHeight: fontSize * lineHeightRatio };
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

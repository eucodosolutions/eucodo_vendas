import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { buildDisplaySvg } from "./template";
import { pixelSize, type ArtInput } from "./types";

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
const FONT_FILES = ["Poppins-400.ttf", "Poppins-500.ttf", "Poppins-600.ttf", "Poppins-700.ttf"].map(
  (file) => path.join(FONT_DIR, file),
);

/**
 * Rasteriza o SVG numa largura fixa. As fontes vao embutidas por arquivo, sem
 * depender do que estiver instalado na maquina ou no servidor da Vercel.
 */
function rasterize(svg: string, width: number): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: {
      fontFiles: FONT_FILES,
      loadSystemFonts: false,
      defaultFontFamily: "Poppins",
    },
  });
  return Buffer.from(resvg.render().asPng());
}

/** Arte final para producao, na resolucao que o tamanho pedir. */
export async function renderPrintJpg(input: ArtInput): Promise<Buffer> {
  const { width } = pixelSize(input.spec);
  const png = rasterize(buildDisplaySvg(input), width);
  return sharp(png)
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
    .withMetadata({ density: input.spec.dpi })
    .toBuffer();
}

/** Previa leve para mandar no WhatsApp, com o canto arredondado do display. */
export async function renderPreviewPng(
  input: ArtInput,
  width = 900,
  options: { showSafeArea?: boolean } = {},
): Promise<Buffer> {
  // Canto de aproximadamente 4 mm, so para a previa parecer o display real.
  const cornerRadius = input.spec.widthMm * 0.04 * 10;
  const svg = buildDisplaySvg(input, { cornerRadius, ...options });
  return sharp(rasterize(svg, width)).png({ compressionLevel: 9 }).toBuffer();
}

export { buildDisplaySvg };

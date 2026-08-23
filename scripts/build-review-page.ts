import fs from "node:fs/promises";
import path from "node:path";
import { renderPreviewPng } from "../src/lib/art/render";
import { type ArtColor, type ArtTech } from "../src/lib/art/types";
import { specDoTamanho, TAMANHOS } from "../src/lib/catalogo";

/**
 * Monta a pagina de aprovacao da arte com as previas embutidas em base64.
 * As imagens saem do mesmo motor que gera o arquivo do pedido, entao o que o
 * Joel aprova aqui e exatamente o que o cliente recebe.
 */

const TEMPLATE = path.join(process.cwd(), "docs", "review", "arte.template.html");
const OUTPUT = process.argv[2] ?? path.join(process.cwd(), ".preview", "aprovacao-arte.html");

const REVIEW_URL = "https://g.page/r/CQhExemploDeLinkDeAvaliacao/review";

const SLOTS: Array<{
  token: string;
  color: ArtColor;
  tech: ArtTech;
  business: string;
  size?: keyof typeof TAMANHOS;
  safeArea?: boolean;
}> = [
  { token: "IMG_BRANCO_NFC", color: "branco", tech: "qr_nfc", business: "Barbearia Vintage" },
  { token: "IMG_PRETO_NFC", color: "preto", tech: "qr_nfc", business: "Barbearia Vintage" },
  { token: "IMG_BRANCO_QR", color: "branco", tech: "qr", business: "Barbearia Vintage" },
  { token: "IMG_PRETO_QR", color: "preto", tech: "qr", business: "Barbearia Vintage" },
  { token: "IMG_NOME_CURTO", color: "branco", tech: "qr_nfc", business: "Bistrô" },
  {
    token: "IMG_NOME_LONGO",
    color: "branco",
    tech: "qr_nfc",
    business: "Restaurante Sabor da Terra Nordestina",
  },
  {
    token: "IMG_MARGEM",
    color: "branco",
    tech: "qr_nfc",
    business: "Barbearia Vintage",
    safeArea: true,
  },
  { token: "IMG_A5", color: "branco", tech: "qr_nfc", business: "Barbearia Vintage", size: "a5" },
];

async function main() {
  let html = await fs.readFile(TEMPLATE, "utf8");

  for (const slot of SLOTS) {
    const png = await renderPreviewPng(
      {
        spec: specDoTamanho(slot.size ?? "a6"),
        color: slot.color,
        tech: slot.tech,
        businessName: slot.business,
        reviewUrl: REVIEW_URL,
      },
      720,
      { showSafeArea: slot.safeArea },
    );
    const dataUri = `data:image/png;base64,${png.toString("base64")}`;
    html = html.replaceAll(`{{${slot.token}}}`, dataUri);
  }

  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(OUTPUT, html, "utf8");

  console.log(`${OUTPUT} (${(Buffer.byteLength(html) / 1024).toFixed(0)} kB)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

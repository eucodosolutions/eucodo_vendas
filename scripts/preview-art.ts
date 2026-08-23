import fs from "node:fs/promises";
import path from "node:path";
import { renderPreviewPng } from "../src/lib/art/render";
import { type ArtColor, type ArtTech } from "../src/lib/art/types";
import { specDoTamanho, TAMANHOS } from "../src/lib/catalogo";

const OUT_DIR = path.join(process.cwd(), ".preview");

const REVIEW_URL = "https://g.page/r/CQhExemploDeLinkDeAvaliacao/review";

const CASES: Array<{
  name: string;
  color: ArtColor;
  tech: ArtTech;
  business: string;
  size?: keyof typeof TAMANHOS;
  safeArea?: boolean;
}> = [
  { name: "branco-nfc", color: "branco", tech: "qr_nfc", business: "Barbearia Vintage" },
  { name: "preto-nfc", color: "preto", tech: "qr_nfc", business: "Barbearia Vintage" },
  { name: "branco-qr", color: "branco", tech: "qr", business: "Barbearia Vintage" },
  { name: "preto-qr", color: "preto", tech: "qr", business: "Barbearia Vintage" },
  { name: "nome-curto", color: "branco", tech: "qr_nfc", business: "Bistrô" },
  {
    name: "nome-longo",
    color: "branco",
    tech: "qr_nfc",
    business: "Restaurante Sabor da Terra Nordestina",
  },
  { name: "a5-branco-nfc", color: "branco", tech: "qr_nfc", business: "Barbearia Vintage", size: "a5" },
  {
    name: "margem-seguranca",
    color: "branco",
    tech: "qr_nfc",
    business: "Barbearia Vintage",
    safeArea: true,
  },
];

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  for (const item of CASES) {
    const buffer = await renderPreviewPng(
      {
        spec: specDoTamanho(item.size ?? "a6"),
        color: item.color,
        tech: item.tech,
        businessName: item.business,
        reviewUrl: REVIEW_URL,
      },
      760,
      { showSafeArea: item.safeArea },
    );
    const file = path.join(OUT_DIR, `${item.name}.png`);
    await fs.writeFile(file, buffer);
    console.log(`${file} (${(buffer.length / 1024).toFixed(0)} kB)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

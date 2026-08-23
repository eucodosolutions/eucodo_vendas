/**
 * Gera os icones do PWA a partir da marca, sem baixar nada.
 *
 * A marca do painel e a letra E branca sobre o azul da Eucodo, exatamente como
 * ela aparece no canto da barra lateral. Desenhar em SVG e rasterizar com sharp
 * mantem os icones colados na identidade: mudar o azul em `globals.css` e rodar
 * `npm run icones` de novo basta.
 *
 * Uso: npm run icones
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const AZUL = "#0360fe";
const PUBLICO = path.join(process.cwd(), "public");

/**
 * @param margem fracao do lado reservada para o recorte do Android. O icone
 *   comum usa pouca margem; o maskable precisa de bastante, porque o sistema
 *   corta em circulo ou gota e comeria as bordas.
 */
function marca(lado: number, margem: number, raio: number): string {
  const area = lado * (1 - margem * 2);
  const inicio = lado * margem;
  const corpo = area * 0.62;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 ${lado} ${lado}">
  <rect width="${lado}" height="${lado}" fill="${AZUL}" />
  <rect x="${inicio}" y="${inicio}" width="${area}" height="${area}" rx="${raio}" fill="${AZUL}" />
  <text
    x="50%"
    y="50%"
    dy="0.35em"
    text-anchor="middle"
    fill="#ffffff"
    font-family="Poppins, Segoe UI, Helvetica, Arial, sans-serif"
    font-weight="700"
    font-size="${corpo}"
  >E</text>
</svg>`;
}

async function gerar(nome: string, lado: number, margem: number) {
  const svg = marca(lado, margem, lado * 0.18);
  const destino = path.join(PUBLICO, nome);

  await sharp(Buffer.from(svg)).png().toFile(destino);
  console.log(`${nome}: ${lado}x${lado}`);
}

async function principal() {
  await mkdir(PUBLICO, { recursive: true });

  await gerar("icone-192.png", 192, 0);
  await gerar("icone-512.png", 512, 0);
  // 20% de cada lado: a zona segura do maskable e o circulo central de 80%.
  await gerar("icone-maskable-512.png", 512, 0.2);
  await gerar("apple-touch-icon.png", 180, 0);

  // O favicon fica de fora: .ico com varias resolucoes nao e o forte do sharp, e
  // o PNG de 192 ja serve de icone de aba nos navegadores atuais.
}

principal().catch((erro) => {
  console.error(erro);
  process.exit(1);
});

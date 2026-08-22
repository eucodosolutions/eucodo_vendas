import QRCode from "qrcode";

/**
 * Gera o QR como caminho vetorial, para imprimir sem perda em qualquer tamanho.
 * O nivel M de correcao ja tolera a colagem no acrilico sem inchar o desenho.
 */
export function qrGroup(
  text: string,
  box: { x: number; y: number; size: number },
  color = "#000000",
  quietModules = 2,
): string {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const count = qr.modules.size;
  const data = qr.modules.data;
  const total = count + quietModules * 2;
  const scale = box.size / total;

  let path = "";
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (!data[row * count + col]) continue;
      path += `M${col + quietModules} ${row + quietModules}h1v1h-1z`;
    }
  }

  return `<g transform="translate(${box.x} ${box.y}) scale(${scale})"><path d="${path}" fill="${color}" shape-rendering="crispEdges"/></g>`;
}

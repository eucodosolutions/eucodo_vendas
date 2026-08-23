export type ArtColor = "branco" | "preto";
export type ArtTech = "qr" | "qr_nfc";

/**
 * Medidas de um tamanho de display. Vive no banco, junto do produto, e nao no
 * codigo: cada cliente do sistema pode cadastrar o proprio tamanho sem deploy.
 */
export type ArtSpec = {
  label: string;
  widthMm: number;
  heightMm: number;
  /** Margem de seguranca interna. Nenhum conteudo passa dela. */
  safeMarginMm: number;
  /** Sangria para a grafica, somada por fora das medidas. */
  bleedMm: number;
  dpi: number;
};

export type ArtInput = {
  spec: ArtSpec;
  color: ArtColor;
  tech: ArtTech;
  /** Nome do negocio, ocupa o topo da arte no lugar do logo do Google. */
  businessName: string;
  /** Link de avaliacao do Google que vira o QR code. */
  reviewUrl: string;
};

export function mmToPx(mm: number, dpi: number): number {
  return (mm * dpi) / 25.4;
}

/** Tamanho do arquivo final em pixels, ja somando a sangria dos dois lados. */
export function pixelSize(spec: ArtSpec) {
  return {
    width: Math.round(mmToPx(spec.widthMm + spec.bleedMm * 2, spec.dpi)),
    height: Math.round(mmToPx(spec.heightMm + spec.bleedMm * 2, spec.dpi)),
  };
}

export type ArtSize = "A5" | "A6";
export type ArtColor = "branco" | "preto";
export type ArtTech = "qr" | "qr_nfc";

export type ArtVariant = {
  size: ArtSize;
  color: ArtColor;
  tech: ArtTech;
};

export type ArtInput = ArtVariant & {
  /** Nome do negocio, ocupa o topo da arte no lugar do logo do Google. */
  businessName: string;
  /** Link de avaliacao do Google que vira o QR code. */
  reviewUrl: string;
};

/** Medidas fisicas em milimetros, sem sangria. */
export const SIZE_MM: Record<ArtSize, { w: number; h: number }> = {
  A5: { w: 148, h: 210 },
  A6: { w: 105, h: 148 },
};

/** Pixels no lado maior para 300 DPI. */
export function pixelSize(size: ArtSize, dpi = 300) {
  const mm = SIZE_MM[size];
  const factor = dpi / 25.4;
  return {
    width: Math.round(mm.w * factor),
    height: Math.round(mm.h * factor),
  };
}

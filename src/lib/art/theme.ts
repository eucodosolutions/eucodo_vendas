import type { ArtColor } from "./types";

/** Cores da marca Google, usadas na borda, nas estrelas e no letreiro. */
export const GOOGLE = {
  blue: "#4285F4",
  red: "#EA4335",
  yellow: "#FBBC05",
  green: "#34A853",
} as const;

/** Ordem das letras de "Google": G azul, o vermelho, o amarelo, g azul, l verde, e vermelho. */
export const GOOGLE_WORDMARK: Array<[string, string]> = [
  ["G", GOOGLE.blue],
  ["o", GOOGLE.red],
  ["o", GOOGLE.yellow],
  ["g", GOOGLE.blue],
  ["l", GOOGLE.green],
  ["e", GOOGLE.red],
];

export type Theme = {
  background: string;
  name: string;
  subtitle: string;
  cardFill: string;
  cardStroke: string;
  cardLabel: string;
  nfcStroke: string;
  panelFill: string;
};

export const THEMES: Record<ArtColor, Theme> = {
  branco: {
    background: "#FFFFFF",
    name: "#202124",
    subtitle: "#5F6368",
    cardFill: "#FFFFFF",
    cardStroke: "#E8EAED",
    cardLabel: "#5F6368",
    nfcStroke: "#202124",
    panelFill: "#FFFFFF",
  },
  preto: {
    background: "#101114",
    name: "#FFFFFF",
    subtitle: "#C9CCD1",
    // O QR fica sempre em cartao claro, para nao comprometer a leitura.
    cardFill: "#FFFFFF",
    cardStroke: "#2A2C31",
    cardLabel: "#5F6368",
    nfcStroke: "#202124",
    panelFill: "#17181C",
  },
};

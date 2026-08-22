/**
 * Medidas e classes compartilhadas dos controles de formulario.
 *
 * Campo, selecao e botao tem a mesma altura, senao um formulario com os tres
 * lado a lado fica desalinhado. O valor mora aqui, num lugar so: mudar a altura
 * padrao do sistema e mudar esta linha.
 */
export const ALTURA_CONTROLE = "h-10";

/** Moldura comum de campo e selecao, para os dois envelhecerem juntos. */
export const MOLDURA_CONTROLE =
  "w-full rounded-lg border bg-superficie text-sm text-tinta transition-colors";

export const BORDA_NORMAL = "border-borda hover:border-borda-forte";
export const BORDA_ERRO = "border-erro";

export function juntar(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const DATA_HORA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const DATA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export function moeda(centavos: number): string {
  return MOEDA.format(centavos / 100);
}

export function dataHora(iso: string): string {
  return DATA_HORA.format(new Date(iso));
}

export function data(iso: string): string {
  return DATA.format(new Date(iso));
}

/**
 * Deixa o numero no formato que a uazapi espera: so digitos, com 55 na frente.
 * Aceita o que a pessoa digitar, inclusive com mascara e com o zero da
 * operadora, e devolve null quando nao da para salvar.
 */
export function normalizarWhatsapp(bruto: string): string | null {
  let digitos = bruto.replace(/\D/g, "");

  if (digitos.startsWith("0")) digitos = digitos.slice(1);
  if (!digitos.startsWith("55")) digitos = `55${digitos}`;

  // 55 + DDD + 8 ou 9 digitos.
  return /^55[1-9][0-9]{9,10}$/.test(digitos) ? digitos : null;
}

/** Escreve o numero de volta no jeito que o Joel le: (85) 9 8707-3847. */
export function whatsappLegivel(normalizado: string): string {
  const semPais = normalizado.replace(/^55/, "");
  const ddd = semPais.slice(0, 2);
  const resto = semPais.slice(2);

  if (resto.length === 9) {
    return `(${ddd}) ${resto[0]} ${resto.slice(1, 5)}-${resto.slice(5)}`;
  }
  return `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`;
}

const DOMINIOS_DE_AVALIACAO = [
  "g.page",
  "search.google.com",
  "maps.app.goo.gl",
  "goo.gl",
  "google.com",
  "maps.google.com",
];

/**
 * O link de avaliacao chega de varios jeitos: o curto do g.page, o encurtado do
 * app de mapas, ou o writereview completo. Aceitamos todos e recusamos o resto,
 * porque link errado vira QR errado impresso em acrilico.
 */
export function validarLinkAvaliacao(bruto: string): string | null {
  const texto = bruto.trim();
  if (!texto) return null;

  const comProtocolo = /^https?:\/\//i.test(texto) ? texto : `https://${texto}`;

  try {
    const url = new URL(comProtocolo);
    const host = url.hostname.replace(/^www\./, "");
    const valido = DOMINIOS_DE_AVALIACAO.some(
      (dominio) => host === dominio || host.endsWith(`.${dominio}`),
    );
    return valido ? url.toString() : null;
  } catch {
    return null;
  }
}

export const ROTULO_COR = { branco: "Branco", preto: "Preto" } as const;

export const ROTULO_TECNOLOGIA = {
  qr: "So QR code",
  qr_nfc: "QR code + aproximacao",
} as const;

export const ROTULO_STATUS = {
  novo: "Novo",
  em_producao: "Em producao",
  pronto: "Pronto",
  entregue: "Entregue",
  cancelado: "Cancelado",
} as const;

export const ROTULO_PAGAMENTO = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartao de credito",
  cartao_debito: "Cartao de debito",
  transferencia: "Transferencia",
} as const;

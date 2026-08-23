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

/** Mascara padrao do sistema para WhatsApp: (00) 0 0000-0000. */
export const MASCARA_WHATSAPP = "(00) 0 0000-0000";
export const TAMANHO_MASCARA_WHATSAPP = MASCARA_WHATSAPP.length;

/**
 * Aplica a mascara enquanto a pessoa digita, aceitando texto colado com ou sem
 * formatacao. Descarta o 55 quando alguem cola o numero em formato
 * internacional, senao o DDD sairia errado.
 */
export function formatarMascaraWhatsapp(bruto: string): string {
  let digitos = bruto.replace(/\D/g, "");

  // O zero da operadora e o 55 do formato internacional atrapalham o DDD.
  if (digitos.startsWith("0")) digitos = digitos.slice(1);
  if (digitos.length > 11 && digitos.startsWith("55")) digitos = digitos.slice(2);
  digitos = digitos.slice(0, 11);

  const ddd = digitos.slice(0, 2);
  const nono = digitos.slice(2, 3);
  const meio = digitos.slice(3, 7);
  const fim = digitos.slice(7, 11);

  if (digitos.length <= 2) return digitos.length ? `(${ddd}` : "";
  if (digitos.length === 3) return `(${ddd}) ${nono}`;
  if (digitos.length <= 7) return `(${ddd}) ${nono} ${meio}`;
  return `(${ddd}) ${nono} ${meio}-${fim}`;
}

/**
 * Deixa o numero no formato que a uazapi espera: so digitos, com 55 na frente.
 * Aceita o que a pessoa digitar, inclusive com mascara e com o zero da
 * operadora, e devolve null quando nao da para salvar.
 *
 * Exige celular: DDD valido e o nono digito. Numero fixo nao entra, porque o
 * destino de tudo que o sistema manda e uma conversa de WhatsApp.
 */
export function normalizarWhatsapp(bruto: string): string | null {
  let digitos = bruto.replace(/\D/g, "");

  if (digitos.startsWith("0")) digitos = digitos.slice(1);
  if (!digitos.startsWith("55")) digitos = `55${digitos}`;

  // 55 + DDD (11 a 99) + 9 + 8 digitos.
  return /^55[1-9][0-9]9[0-9]{8}$/.test(digitos) ? digitos : null;
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
  qr: "Só QR code",
  qr_nfc: "QR code + aproximação",
} as const;

export const ROTULO_TIPO_PRODUTO = {
  avaliacao: "Placa de avaliação",
  padrao: "Padrão",
} as const;

export const ROTULO_STATUS = {
  novo: "Novo",
  em_producao: "Em produção",
  pronto: "Pronto",
  entregue: "Entregue",
  cancelado: "Cancelado",
} as const;

export const ROTULO_PAGAMENTO = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  transferencia: "Transferência",
} as const;

export const ROTULO_STATUS_ASSINATURA = {
  pendente: "Pendente",
  ativa: "Ativa",
  suspensa: "Suspensa",
  cancelada: "Cancelada",
} as const;

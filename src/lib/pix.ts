/**
 * O PIX copia e cola do pedido, no formato BR Code do Banco Central.
 *
 * E um EMV: campos no formato id + tamanho + valor, encadeados, com um CRC no
 * fim. Nada aqui fala com banco nenhum — o codigo e montado a partir da chave
 * que o assinante cadastrou em Ajustes e do total do pedido, e quem le e o app
 * do cliente. Por isso nao ha segredo envolvido e ele pode viver na aplicacao.
 *
 * O valor entra no codigo de proposito: um PIX sem valor faz o cliente digitar
 * o total na mao, que e onde ele erra e paga a menos.
 */

export type DadosPix = {
  chave: string;
  beneficiario: string;
  cidade: string;
};

/** Campo do EMV: dois digitos de id, dois de tamanho, e o valor. */
function campo(id: string, valor: string): string {
  return `${id}${String(valor.length).padStart(2, "0")}${valor}`;
}

/**
 * Nome e cidade viajam em ASCII maiusculo.
 *
 * O leitor de QR de banco nao concorda sobre acento, e "JOÃO" chega torto em
 * parte deles. Como estes dois campos so aparecem para o cliente conferir quem
 * esta recebendo, tirar o acento nao custa nada e evita o codigo recusado.
 */
function ascii(texto: string, limite: number): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .toUpperCase()
    .slice(0, limite);
}

/**
 * CRC16-CCITT (polinomio 0x1021, inicio 0xFFFF), que e o que o BR Code pede.
 *
 * Roda sobre o texto inteiro ja com "6304" no fim: o campo do CRC entra na
 * conta do proprio CRC, com o espaco dele reservado mas ainda vazio.
 */
function crc16(texto: string): string {
  let crc = 0xffff;

  for (let i = 0; i < texto.length; i++) {
    crc ^= texto.charCodeAt(i) << 8;

    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Monta o copia e cola de um pedido.
 *
 * Devolve `null` quando a conta ainda nao tem PIX configurado, em vez de gerar
 * um codigo quebrado: quem chama usa isso para cair na mensagem sem cobranca.
 */
export function pixCopiaECola(
  dados: Partial<DadosPix>,
  valorCentavos: number,
  referencia: string,
): string | null {
  const chave = dados.chave?.trim();
  if (!chave || valorCentavos <= 0) return null;

  const beneficiario = ascii(dados.beneficiario ?? "", 25) || "RECEBEDOR";
  const cidade = ascii(dados.cidade ?? "", 15) || "BRASIL";

  // So letra e numero, o que o campo aceita. "EV-0042" vira "EV0042".
  const txid = referencia.replace(/[^a-zA-Z0-9]/g, "").slice(0, 25) || "***";

  const corpo = [
    campo("00", "01"),
    // 12 = uso unico. Este codigo carrega o total e o numero de um pedido so.
    campo("01", "12"),
    campo("26", campo("00", "br.gov.bcb.pix") + campo("01", chave)),
    campo("52", "0000"),
    campo("53", "986"),
    campo("54", (valorCentavos / 100).toFixed(2)),
    campo("58", "BR"),
    campo("59", beneficiario),
    campo("60", cidade),
    campo("62", campo("05", txid)),
  ].join("");

  const comEspacoDoCrc = `${corpo}6304`;
  return `${comEspacoDoCrc}${crc16(comEspacoDoCrc)}`;
}

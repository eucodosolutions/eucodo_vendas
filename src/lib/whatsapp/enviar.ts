import "server-only";

import { createClient } from "@/lib/supabase/server";

export type ChaveMensagem =
  | "pedido_criado"
  /** O mesmo fechamento, com o PIX copia e cola no fim. */
  | "pedido_criado_pix"
  | "status_em_producao"
  | "status_pronto"
  | "status_entregue"
  | "status_cancelado"
  | "pagamento_confirmado";

export type ResultadoEnvio = {
  enviado: boolean;
  via: "uazapi" | "link";
  /** Presente quando o envio caiu no link manual. */
  link?: string;
  texto?: string;
  erro?: string;
};

/**
 * Pede a Edge Function que mande a mensagem.
 *
 * A aplicacao nao conhece o token da uazapi nem a chave de servico: manda o JWT
 * do vendedor e a funcao decide. Quando nao ha instancia conectada, a resposta
 * traz um link do WhatsApp com a mensagem pronta, e quem manda e o vendedor.
 */
export async function enviarWhatsapp(
  pedidoId: string,
  chave: ChaveMensagem,
  opcoes: { semArte?: boolean } = {},
): Promise<ResultadoEnvio> {
  const supabase = await createClient();

  const { data, error } = await supabase.functions.invoke<ResultadoEnvio>("whatsapp", {
    body: { pedidoId, chave, semArte: opcoes.semArte ?? false },
  });

  if (error || !data) {
    return {
      enviado: false,
      via: "link",
      erro: error?.message ?? "A função de envio não respondeu.",
    };
  }

  return data;
}

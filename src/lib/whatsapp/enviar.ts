import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { FormaCombinada, MomentoPagamento } from "@/types/database";

export type ChaveMensagem =
  /** Fechamento sem combinado gravado. E a rede de seguranca, nao o caminho. */
  | "pedido_criado"
  /** Um por combinado: o texto muda com a forma e com o momento do pagamento. */
  | "pedido_criado_pix_agora"
  | "pedido_criado_pix_entrega"
  | "pedido_criado_dinheiro_agora"
  | "pedido_criado_dinheiro_entrega"
  | "status_em_producao"
  | "status_pronto"
  | "status_entregue"
  | "status_cancelado"
  | "pagamento_confirmado";

/**
 * Qual mensagem de fechamento cabe no que foi combinado.
 *
 * Mora aqui, e nao na tela de venda, porque quem reenvia a mensagem na pagina
 * do pedido precisa chegar na mesma resposta: o reenvio mandava sempre o texto
 * generico, entao um pedido fechado em PIX a vista era cobrado direito na
 * primeira mensagem e virava "acerte o pagamento por aqui" na segunda.
 *
 * `temPix` e o desempate do PIX a vista: sem o copia e cola gravado — conta sem
 * chave em Ajustes, ou gravacao que falhou — o modelo prometeria um codigo que
 * nao vai junto, e o generico e o que sobra.
 */
export function chaveDoFechamento({
  forma,
  momento,
  temPix,
}: {
  forma: FormaCombinada | null;
  momento: MomentoPagamento | null;
  temPix: boolean;
}): ChaveMensagem {
  if (!forma || !momento) return "pedido_criado";

  if (forma === "pix") {
    if (momento === "na_entrega") return "pedido_criado_pix_entrega";
    return temPix ? "pedido_criado_pix_agora" : "pedido_criado";
  }

  return momento === "agora" ? "pedido_criado_dinheiro_agora" : "pedido_criado_dinheiro_entrega";
}

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

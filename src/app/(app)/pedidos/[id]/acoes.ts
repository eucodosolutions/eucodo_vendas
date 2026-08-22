"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { renderPreviewPng, renderPrintJpg } from "@/lib/art/render";
import { specDoTamanho } from "@/lib/art/spec";
import { createClient } from "@/lib/supabase/server";
import { enviarWhatsapp, type ChaveMensagem } from "@/lib/whatsapp/enviar";
import type { FormaPagamento, StatusPedido } from "@/types/database";

export type EstadoAcao = {
  erro?: string;
  sucesso?: string;
  /** Preenchido quando a mensagem nao saiu pela API e precisa ir na mao. */
  link?: string;
};

/** Cada mudanca de status tem a sua mensagem. Entregue e o fim da conversa. */
const MENSAGEM_DO_STATUS: Partial<Record<StatusPedido, ChaveMensagem>> = {
  em_producao: "status_em_producao",
  pronto: "status_pronto",
  entregue: "status_entregue",
  cancelado: "status_cancelado",
};

const STATUS_VALIDOS = ["novo", "em_producao", "pronto", "entregue"] as const;

const esquemaStatus = z.object({
  pedidoId: z.string().uuid(),
  status: z.enum(STATUS_VALIDOS),
});

const esquemaPagamento = z.object({
  pedidoId: z.string().uuid(),
  forma: z.enum(["pix", "dinheiro", "cartao_credito", "cartao_debito", "transferencia"]),
});

const esquemaCancelamento = z.object({
  pedidoId: z.string().uuid(),
  motivo: z.string().trim().min(3, "Escreva o motivo do cancelamento."),
});

async function sessao() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function mudarStatus(_estado: EstadoAcao, dados: FormData): Promise<EstadoAcao> {
  const resultado = esquemaStatus.safeParse({
    pedidoId: dados.get("pedidoId"),
    status: dados.get("status"),
  });
  if (!resultado.success) return { erro: "Status inválido." };

  const { supabase, user } = await sessao();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("status")
    .eq("id", resultado.data.pedidoId)
    .single();

  if (!pedido) return { erro: "Pedido não encontrado." };
  if (pedido.status === "cancelado") {
    return { erro: "Pedido cancelado não muda de status." };
  }

  const { error } = await supabase
    .from("pedidos")
    .update({ status: resultado.data.status })
    .eq("id", resultado.data.pedidoId);

  if (error) return { erro: "Não consegui mudar o status." };

  await registrarEvento({
    supabase,
    pedidoId: resultado.data.pedidoId,
    tipo: "status",
    de: pedido.status,
    para: resultado.data.status,
    autorId: user.id,
  });

  const chave = MENSAGEM_DO_STATUS[resultado.data.status];
  const envio = chave ? await enviarWhatsapp(resultado.data.pedidoId, chave) : null;

  revalidatePath(`/pedidos/${resultado.data.pedidoId}`);
  revalidatePath("/pedidos");

  return {
    sucesso: mensagemDeEnvio(`Status alterado para ${rotulo(resultado.data.status)}.`, envio),
    link: envio?.enviado === false ? envio.link : undefined,
  };
}

export async function marcarPago(_estado: EstadoAcao, dados: FormData): Promise<EstadoAcao> {
  const resultado = esquemaPagamento.safeParse({
    pedidoId: dados.get("pedidoId"),
    forma: dados.get("forma"),
  });
  if (!resultado.success) return { erro: "Escolha a forma de pagamento." };

  const { supabase, user } = await sessao();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };

  const { error } = await supabase
    .from("pedidos")
    .update({
      pagamento: "pago",
      forma_pagamento: resultado.data.forma as FormaPagamento,
      pago_em: new Date().toISOString(),
    })
    .eq("id", resultado.data.pedidoId)
    .eq("pagamento", "pendente");

  if (error) return { erro: "Não consegui baixar o pagamento." };

  await registrarEvento({
    supabase,
    pedidoId: resultado.data.pedidoId,
    tipo: "pagamento",
    de: "pendente",
    para: "pago",
    detalhe: `Forma: ${resultado.data.forma}`,
    autorId: user.id,
  });

  const envio = await enviarWhatsapp(resultado.data.pedidoId, "pagamento_confirmado", {
    semArte: true,
  });

  revalidatePath(`/pedidos/${resultado.data.pedidoId}`);
  revalidatePath("/pedidos");

  return {
    sucesso: mensagemDeEnvio("Pagamento registrado.", envio),
    link: envio.enviado ? undefined : envio.link,
  };
}

export async function cancelarPedido(_estado: EstadoAcao, dados: FormData): Promise<EstadoAcao> {
  const resultado = esquemaCancelamento.safeParse({
    pedidoId: dados.get("pedidoId"),
    motivo: dados.get("motivo"),
  });
  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Escreva o motivo." };
  }

  const { supabase, user } = await sessao();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("status")
    .eq("id", resultado.data.pedidoId)
    .single();

  if (!pedido) return { erro: "Pedido não encontrado." };
  if (pedido.status === "cancelado") return { erro: "Este pedido já está cancelado." };

  const { error } = await supabase
    .from("pedidos")
    .update({
      status: "cancelado",
      cancelado_em: new Date().toISOString(),
      motivo_cancelamento: resultado.data.motivo,
    })
    .eq("id", resultado.data.pedidoId);

  if (error) return { erro: "Não consegui cancelar o pedido." };

  await registrarEvento({
    supabase,
    pedidoId: resultado.data.pedidoId,
    tipo: "cancelamento",
    de: pedido.status,
    para: "cancelado",
    detalhe: resultado.data.motivo,
    autorId: user.id,
  });

  const envio = await enviarWhatsapp(resultado.data.pedidoId, "status_cancelado", {
    semArte: true,
  });

  revalidatePath(`/pedidos/${resultado.data.pedidoId}`);
  revalidatePath("/pedidos");

  return {
    sucesso: mensagemDeEnvio("Pedido cancelado.", envio),
    link: envio.enviado ? undefined : envio.link,
  };
}

/** Reenvia a arte e o resumo, para quando o cliente pede de novo. */
export async function reenviarMensagem(_estado: EstadoAcao, dados: FormData): Promise<EstadoAcao> {
  const pedidoId = z.string().uuid().safeParse(dados.get("pedidoId"));
  if (!pedidoId.success) return { erro: "Pedido inválido." };

  const { user } = await sessao();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };

  const envio = await enviarWhatsapp(pedidoId.data, "pedido_criado");
  revalidatePath(`/pedidos/${pedidoId.data}`);

  return {
    sucesso: mensagemDeEnvio("Mensagem preparada.", envio),
    link: envio.enviado ? undefined : envio.link,
  };
}

/**
 * O texto que o vendedor le. Quando a instancia nao esta conectada, a acao nao
 * e um erro: o pedido mudou de estado e a mensagem so precisa sair na mao.
 */
function mensagemDeEnvio(
  base: string,
  envio: { enviado: boolean; link?: string } | null,
): string {
  if (!envio) return base;
  if (envio.enviado) return `${base} Cliente avisado no WhatsApp.`;
  return envio.link
    ? `${base} Sem instância conectada, use o botão para mandar a mensagem.`
    : `${base} Não consegui avisar o cliente.`;
}

/** Refaz os arquivos da arte. Serve quando a geracao falhou na hora da venda. */
export async function regerarArte(_estado: EstadoAcao, dados: FormData): Promise<EstadoAcao> {
  const pedidoId = z.string().uuid().safeParse(dados.get("pedidoId"));
  if (!pedidoId.success) return { erro: "Pedido inválido." };

  const { supabase, user } = await sessao();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("id, codigo, nome_negocio, link_avaliacao, cor, tecnologia, tamanho_codigo")
    .eq("id", pedidoId.data)
    .single();

  if (!pedido) return { erro: "Pedido não encontrado." };

  const { data: tamanho } = await supabase
    .from("tamanhos")
    .select("codigo, rotulo, largura_mm, altura_mm, margem_seguranca_mm, sangria_mm, dpi")
    .eq("codigo", pedido.tamanho_codigo)
    .single();

  if (!tamanho) return { erro: "O tamanho deste pedido não existe mais no cadastro." };

  try {
    const arte = {
      spec: specDoTamanho(tamanho),
      color: pedido.cor,
      tech: pedido.tecnologia,
      businessName: pedido.nome_negocio,
      reviewUrl: pedido.link_avaliacao,
    };

    const [jpg, previa] = await Promise.all([renderPrintJpg(arte), renderPreviewPng(arte)]);
    const base = `pedidos/${pedido.codigo}`;

    await supabase.storage
      .from("artes")
      .upload(`${base}/arte.jpg`, jpg, { contentType: "image/jpeg", upsert: true });
    await supabase.storage
      .from("artes")
      .upload(`${base}/previa.png`, previa, { contentType: "image/png", upsert: true });

    await supabase
      .from("pedidos")
      .update({
        arte_jpg_path: `${base}/arte.jpg`,
        arte_preview_path: `${base}/previa.png`,
      })
      .eq("id", pedido.id);
  } catch (erro) {
    console.error("Falha ao regerar arte", pedido.codigo, erro);
    return { erro: "A geração da arte falhou. Confira o link de avaliação." };
  }

  revalidatePath(`/pedidos/${pedido.id}`);
  return { sucesso: "Arte gerada de novo." };
}

async function registrarEvento({
  supabase,
  pedidoId,
  tipo,
  de,
  para,
  detalhe,
  autorId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  pedidoId: string;
  tipo: string;
  de: string | null;
  para: string;
  detalhe?: string;
  autorId: string;
}) {
  await supabase.from("pedido_eventos").insert({
    pedido_id: pedidoId,
    tipo,
    de,
    para,
    detalhe: detalhe ?? null,
    autor_id: autorId,
  });
}

function rotulo(status: StatusPedido): string {
  const mapa: Record<StatusPedido, string> = {
    novo: "novo",
    em_producao: "em produção",
    pronto: "pronto",
    entregue: "entregue",
    cancelado: "cancelado",
  };
  return mapa[status];
}

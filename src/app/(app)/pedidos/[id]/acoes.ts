"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { renderPreviewPng, renderPrintJpg } from "@/lib/art/render";
import { specDoProduto } from "@/lib/art/spec";
import { detalheDaPlaca } from "@/lib/catalogo";
import { createClient } from "@/lib/supabase/server";
import { chaveDoFechamento, enviarWhatsapp, type ChaveMensagem } from "@/lib/whatsapp/enviar";
import type { FormaPagamento, PedidoItem, StatusPedido } from "@/types/database";

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

/**
 * Reenvia a arte e o resumo, para quando o cliente pede de novo.
 *
 * A mensagem e a mesma do fechamento, escolhida pelo que ficou combinado no
 * pedido. Antes daqui saia sempre o texto generico, entao um pedido fechado em
 * PIX a vista era cobrado com o copia e cola na primeira mensagem e virava "e
 * so acertar o pagamento por aqui" na segunda — sem codigo nenhum.
 */
export async function reenviarMensagem(_estado: EstadoAcao, dados: FormData): Promise<EstadoAcao> {
  const pedidoId = z.string().uuid().safeParse(dados.get("pedidoId"));
  if (!pedidoId.success) return { erro: "Pedido inválido." };

  const { supabase, user } = await sessao();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("forma_combinada, momento_pagamento, pix_copia_e_cola")
    .eq("id", pedidoId.data)
    .single();

  if (!pedido) return { erro: "Pedido não encontrado." };

  const envio = await enviarWhatsapp(
    pedidoId.data,
    chaveDoFechamento({
      forma: pedido.forma_combinada,
      momento: pedido.momento_pagamento,
      temPix: Boolean(pedido.pix_copia_e_cola),
    }),
  );

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

/**
 * Refaz os arquivos de arte do pedido, item por item.
 *
 * Serve quando a geracao falhou na hora da venda, e quando o pedido tem varias
 * placas e so uma delas ficou sem arquivo. Cada item tem a propria arte, entao
 * cada item e regerado com os dados que ficaram guardados nele.
 */
type ProdutoParaArte = {
  id: string;
  nome: string;
  produto_avaliacao: {
    largura_mm: number;
    altura_mm: number;
    margem_seguranca_mm: number;
    sangria_mm: number;
    dpi: number;
  } | null;
};

export async function regerarArte(_estado: EstadoAcao, dados: FormData): Promise<EstadoAcao> {
  const pedidoId = z.string().uuid().safeParse(dados.get("pedidoId"));
  if (!pedidoId.success) return { erro: "Pedido inválido." };

  const { supabase, user } = await sessao();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("id, codigo, assinatura_id, pedido_itens (*)")
    .eq("id", pedidoId.data)
    .single<{ id: string; codigo: string; assinatura_id: string; pedido_itens: PedidoItem[] }>();

  if (!pedido) return { erro: "Pedido não encontrado." };

  // Produto padrao nao tem arte: sobra so o que foi vendido como placa.
  const placas = pedido.pedido_itens.filter((item) => item.tipo === "avaliacao");

  if (placas.length === 0) {
    return { erro: "Este pedido não tem nenhuma placa para gerar arte." };
  }

  const ids = [...new Set(placas.map((item) => item.produto_id))];

  const { data: produtos } = await supabase
    .from("produtos")
    .select(
      `id, nome, ${detalheDaPlaca("largura_mm, altura_mm, margem_seguranca_mm, sangria_mm, dpi")}`,
    )
    .in("id", ids)
    .returns<ProdutoParaArte[]>();

  const porId = new Map(
    (produtos ?? [])
      .filter((produto) => produto.produto_avaliacao !== null)
      .map((produto) => [produto.id, produto]),
  );

  const faltando = placas.find((item) => !porId.has(item.produto_id));
  if (faltando) {
    return { erro: `O produto ${faltando.produto_nome} não existe mais no seu catálogo.` };
  }

  let refeitos = 0;

  for (const item of placas) {
    try {
      const produto = porId.get(item.produto_id)!;
      const arte = {
        spec: specDoProduto(produto, produto.produto_avaliacao!),
        color: item.cor!,
        tech: item.tecnologia!,
        businessName: item.nome_negocio!,
        reviewUrl: item.link_avaliacao!,
      };

      const [jpg, previa] = await Promise.all([renderPrintJpg(arte), renderPreviewPng(arte)]);
      const base = `${pedido.assinatura_id}/${pedido.codigo}/${item.ordem}`;

      await supabase.storage
        .from("artes")
        .upload(`${base}/arte.jpg`, jpg, { contentType: "image/jpeg", upsert: true });
      await supabase.storage
        .from("artes")
        .upload(`${base}/previa.png`, previa, { contentType: "image/png", upsert: true });

      await supabase
        .from("pedido_itens")
        .update({
          arte_jpg_path: `${base}/arte.jpg`,
          arte_preview_path: `${base}/previa.png`,
        })
        .eq("id", item.id);

      refeitos += 1;
    } catch (erro) {
      console.error("Falha ao regerar arte", pedido.codigo, item.ordem, erro);
    }
  }

  revalidatePath(`/pedidos/${pedido.id}`);

  if (refeitos === 0) {
    return { erro: "A geração da arte falhou. Confira os links de avaliação dos itens." };
  }

  if (refeitos < placas.length) {
    return {
      sucesso: `${refeitos} de ${placas.length} artes foram geradas. Confira o link das que faltaram.`,
    };
  }

  return {
    sucesso: refeitos === 1 ? "Arte gerada de novo." : `${refeitos} artes geradas de novo.`,
  };
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

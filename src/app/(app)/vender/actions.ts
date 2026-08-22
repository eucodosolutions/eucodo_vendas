"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { specDoTamanho } from "@/lib/art/spec";
import { renderPreviewPng, renderPrintJpg } from "@/lib/art/render";
import { normalizarWhatsapp, validarLinkAvaliacao } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { enviarWhatsapp } from "@/lib/whatsapp/enviar";

export type EstadoVenda = { erro?: string };

const esquema = z.object({
  varianteId: z.string().uuid("Escolha um modelo de display."),
  nomeNegocio: z.string().trim().min(2, "Digite o nome do negocio."),
  whatsapp: z.string().trim().min(1, "Digite o WhatsApp do cliente."),
  linkAvaliacao: z.string().trim().min(1, "Cole o link de avaliacao do Google."),
  placeId: z.string().trim().optional(),
  quantidade: z.coerce.number().int().min(1).max(999),
  observacoes: z.string().trim().max(500).optional(),
});

export async function criarPedido(_estado: EstadoVenda, dados: FormData): Promise<EstadoVenda> {
  const resultado = esquema.safeParse({
    varianteId: dados.get("varianteId"),
    nomeNegocio: dados.get("nomeNegocio"),
    whatsapp: dados.get("whatsapp"),
    linkAvaliacao: dados.get("linkAvaliacao"),
    placeId: dados.get("placeId") ?? undefined,
    quantidade: dados.get("quantidade") ?? 1,
    observacoes: dados.get("observacoes") ?? undefined,
  });

  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Confira os dados do pedido." };
  }

  const whatsapp = normalizarWhatsapp(resultado.data.whatsapp);
  if (!whatsapp) {
    return { erro: "Esse WhatsApp nao parece valido. Confira o DDD e o numero." };
  }

  const linkAvaliacao = validarLinkAvaliacao(resultado.data.linkAvaliacao);
  if (!linkAvaliacao) {
    return {
      erro: "Esse link nao parece do Google. Use o link de avaliacao do perfil do negocio.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: variante, error: erroVariante } = await supabase
    .from("variantes")
    .select(
      "id, cor, tecnologia, preco_centavos, tamanhos (codigo, rotulo, largura_mm, altura_mm, margem_seguranca_mm, sangria_mm, dpi)",
    )
    .eq("id", resultado.data.varianteId)
    .eq("ativo", true)
    .single<{
      id: string;
      cor: "branco" | "preto";
      tecnologia: "qr" | "qr_nfc";
      preco_centavos: number;
      tamanhos: {
        codigo: string;
        rotulo: string;
        largura_mm: number;
        altura_mm: number;
        margem_seguranca_mm: number;
        sangria_mm: number;
        dpi: number;
      };
    }>();

  if (erroVariante || !variante) {
    return { erro: "Esse modelo nao esta mais disponivel. Escolha outro." };
  }

  const quantidade = resultado.data.quantidade;
  const total = variante.preco_centavos * quantidade;

  const { data: pedido, error: erroPedido } = await supabase
    .from("pedidos")
    .insert({
      variante_id: variante.id,
      nome_negocio: resultado.data.nomeNegocio,
      whatsapp,
      link_avaliacao: linkAvaliacao,
      google_place_id: resultado.data.placeId || null,
      tamanho_codigo: variante.tamanhos.codigo,
      cor: variante.cor,
      tecnologia: variante.tecnologia,
      quantidade,
      preco_unitario_centavos: variante.preco_centavos,
      total_centavos: total,
      status: "novo",
      pagamento: "pendente",
      forma_pagamento: null,
      pago_em: null,
      cancelado_em: null,
      motivo_cancelamento: null,
      arte_jpg_path: null,
      arte_preview_path: null,
      origem: "painel",
      criado_por: user.id,
      observacoes: resultado.data.observacoes || null,
    })
    .select("id, codigo")
    .single();

  if (erroPedido || !pedido) {
    return { erro: "Nao consegui gravar o pedido. Tente de novo." };
  }

  await gerarEGuardarArte({
    supabase,
    pedidoId: pedido.id,
    codigo: pedido.codigo,
    entrada: {
      spec: specDoTamanho(variante.tamanhos),
      cor: variante.cor,
      tecnologia: variante.tecnologia,
      nomeNegocio: resultado.data.nomeNegocio,
      linkAvaliacao,
    },
  });

  await supabase.from("pedido_eventos").insert({
    pedido_id: pedido.id,
    tipo: "criado",
    de: null,
    para: "novo",
    detalhe: `Pedido aberto no painel por ${user.email ?? "usuario"}`,
    autor_id: user.id,
  });

  // A arte sai junto da mensagem. Se nao houver instancia conectada, a pagina
  // do pedido mostra o botao que abre o WhatsApp com o texto pronto.
  const envio = await enviarWhatsapp(pedido.id, "pedido_criado");

  redirect(`/pedidos/${pedido.id}?novo=1&envio=${envio.enviado ? "ok" : "link"}`);
}

type EntradaArte = {
  spec: ReturnType<typeof specDoTamanho>;
  cor: "branco" | "preto";
  tecnologia: "qr" | "qr_nfc";
  nomeNegocio: string;
  linkAvaliacao: string;
};

/**
 * Gera os dois arquivos e guarda no bucket privado.
 *
 * A falha aqui nao derruba o pedido: o pedido ja esta gravado e a arte pode ser
 * gerada de novo na tela do pedido. Perder a venda por causa de um erro de
 * renderizacao seria o pior desfecho possivel.
 */
async function gerarEGuardarArte({
  supabase,
  pedidoId,
  codigo,
  entrada,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  pedidoId: string;
  codigo: string;
  entrada: EntradaArte;
}) {
  try {
    const arte = {
      spec: entrada.spec,
      color: entrada.cor,
      tech: entrada.tecnologia,
      businessName: entrada.nomeNegocio,
      reviewUrl: entrada.linkAvaliacao,
    };

    const [jpg, preview] = await Promise.all([renderPrintJpg(arte), renderPreviewPng(arte)]);

    const base = `pedidos/${codigo}`;
    const caminhoJpg = `${base}/arte.jpg`;
    const caminhoPreview = `${base}/previa.png`;

    await supabase.storage
      .from("artes")
      .upload(caminhoJpg, jpg, { contentType: "image/jpeg", upsert: true });
    await supabase.storage
      .from("artes")
      .upload(caminhoPreview, preview, { contentType: "image/png", upsert: true });

    await supabase
      .from("pedidos")
      .update({ arte_jpg_path: caminhoJpg, arte_preview_path: caminhoPreview })
      .eq("id", pedidoId);
  } catch (erro) {
    console.error("Falha ao gerar a arte do pedido", codigo, erro);
  }
}

import "server-only";

import { renderPreviewPng, renderPrintJpg } from "./render";
import { specDoProduto } from "./spec";
import { detalheDaPlaca } from "@/lib/catalogo";
import { createClient } from "@/lib/supabase/server";
import type { PedidoItem } from "@/types/database";

/**
 * Desenhar as artes de um pedido, num lugar so.
 *
 * O mesmo laco existia em duas copias: uma no fechamento da venda, que
 * desenhava com o que ainda estava na memoria da acao, e outra no "Gerar as
 * artes de novo" da tela do pedido, que relia tudo do banco. As duas ja tinham
 * divergido — uma gerava as placas em paralelo, a outra uma a uma — e agora ha
 * um terceiro chamador, o passo de arte do fechamento em etapas. Uma copia so.
 *
 * Le tudo do banco de proposito, mesmo no fechamento, onde a acao acabou de
 * gravar os itens: o que vai impresso e o que ficou carimbado na linha, e nao o
 * que o navegador mandou. Uma placa reimpressa amanha sai igual a de hoje.
 *
 * Uma placa de cada vez, e nao todas juntas: o resvg e o sharp queimam CPU de
 * verdade, e seis placas em paralelo travam o servidor inteiro no minuto em que
 * o vendedor mais precisa dele. Em fila, cada uma que termina ja fica gravada.
 */
export type ArtesDoPedido = {
  /** Placas que entraram nesta passada. Zero quando o pedido nao tem nenhuma. */
  total: number;
  feitas: number;
  /** So quando nem deu para tentar: pedido sumido, produto fora do catalogo. */
  erro?: string;
};

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

type PedidoParaArte = {
  id: string;
  codigo: string;
  assinatura_id: string;
  pedido_itens: PedidoItem[];
};

export async function gerarArtesDoPedido(
  pedidoId: string,
  /**
   * `refazer` desenha tudo de novo, inclusive o que ja tem arquivo. E o botao
   * da tela do pedido. Sem ele, so entram as placas que ficaram sem arte, que e
   * o que o fechamento precisa e o que evita redesenhar o pedido inteiro.
   *
   * `ordem` desenha uma placa so, a daquela linha. E o que deixa o fechamento
   * contar "2 de 3" na tela sem inventar: cada volta desenha uma e responde,
   * entao o numero que o vendedor le e o numero de placas que ja estao gravadas.
   */
  opcoes: { refazer?: boolean; ordem?: number } = {},
): Promise<ArtesDoPedido> {
  const supabase = await createClient();

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("id, codigo, assinatura_id, pedido_itens (*)")
    .eq("id", pedidoId)
    .single<PedidoParaArte>();

  if (!pedido) return { total: 0, feitas: 0, erro: "Pedido não encontrado." };

  // Produto padrao nao tem arte: sobra so o que foi vendido como placa.
  const placas = pedido.pedido_itens
    .filter((item) => item.tipo === "avaliacao")
    .filter((item) => opcoes.ordem === undefined || item.ordem === opcoes.ordem)
    .filter((item) => opcoes.refazer || !item.arte_jpg_path)
    .sort((a, b) => a.ordem - b.ordem);

  if (placas.length === 0) return { total: 0, feitas: 0 };

  const { data: produtos } = await supabase
    .from("produtos")
    .select(
      `id, nome, ${detalheDaPlaca("largura_mm, altura_mm, margem_seguranca_mm, sangria_mm, dpi")}`,
    )
    .in("id", [...new Set(placas.map((item) => item.produto_id))])
    .returns<ProdutoParaArte[]>();

  const porId = new Map(
    (produtos ?? [])
      .filter((produto) => produto.produto_avaliacao !== null)
      .map((produto) => [produto.id, produto]),
  );

  const semProduto = placas.find((item) => !porId.has(item.produto_id));
  if (semProduto) {
    return {
      total: placas.length,
      feitas: 0,
      erro: `O produto ${semProduto.produto_nome} não existe mais no seu catálogo.`,
    };
  }

  let feitas = 0;

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
        .update({ arte_jpg_path: `${base}/arte.jpg`, arte_preview_path: `${base}/previa.png` })
        .eq("id", item.id);

      feitas += 1;
    } catch (erro) {
      // A falha de uma placa nao derruba as outras nem o pedido: o arquivo pode
      // ser gerado de novo na tela do pedido, e perder a venda por causa de uma
      // renderizacao seria o pior desfecho possivel.
      console.error("Falha ao gerar a arte", pedido.codigo, "item", item.ordem, erro);
    }
  }

  return { total: placas.length, feitas };
}

/** Quantas placas do pedido ainda esperam arquivo, sem desenhar nada. */
export function placasSemArte(itens: Array<Pick<PedidoItem, "tipo" | "arte_jpg_path">>): number {
  return itens.filter((item) => item.tipo === "avaliacao" && !item.arte_jpg_path).length;
}

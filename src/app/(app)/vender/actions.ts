"use server";

import { z } from "zod";

import { gerarArtesDoPedido } from "@/lib/art/pedido";
import { CORES, detalheDaPlaca } from "@/lib/catalogo";
import { validarLinkAvaliacao } from "@/lib/formato";
import { pixCopiaECola } from "@/lib/pix";
import { sessaoDoPainel } from "@/lib/supabase/painel";
import { createClient } from "@/lib/supabase/server";
import { chaveDoFechamento, enviarWhatsapp } from "@/lib/whatsapp/enviar";
import type { CorArte, FormaCombinada, MomentoPagamento, ProdutoAvaliacao } from "@/types/database";

/**
 * O fechamento sai em tres chamadas, e nao numa so.
 *
 * Fechar um pedido leva segundos de verdade: grava, desenha a arte de cada
 * placa, monta o PIX e chama o WhatsApp. Numa chamada unica isso e uma roda
 * girando sobre um buraco — o vendedor com o cliente na frente nao sabe se
 * falta um segundo ou dez, nem o que fazer quando algo nao sai. Em tres, a tela
 * diz em que passo esta porque o servidor acabou de responder aquele passo, e
 * nao porque um cronometro adivinhou.
 *
 * A ordem importa e nao pode ser embaralhada: sem o pedido gravado nao ha item
 * para desenhar, e sem os itens somados pelo gatilho o PIX sairia com total
 * zerado. Por isso cada passo recebe o `pedidoId` do anterior.
 *
 * Falhar no meio deixa de ser desastre: o pedido ja existe a partir do primeiro
 * passo, e os outros dois sao exatamente os botoes que a tela do pedido ja
 * tinha — "Gerar as artes que faltam" e "Mandar as artes no WhatsApp". Quem
 * parou no passo dois chega na tela do pedido sabendo o que apertar.
 */
export type PedidoAberto = {
  pedidoId: string;
  codigo: string;
  /**
   * A ordem de cada placa do pedido, que e por onde o passo da arte pede uma de
   * cada vez. Vazio num pedido so de produto padrao, e ai o passo nem acontece.
   */
  placas: number[];
};

export type AberturaDoPedido =
  | { erro: string; pedido?: never }
  | { erro?: never; pedido: PedidoAberto };

/** Como o cliente ficou sabendo, no formato que a tela do pedido traduz. */
export type DesfechoDoEnvio = "ok" | "link" | "nao";

export type ArtesDoFechamento = { total: number; feitas: number; erro?: string };

export type ItemParaPedido = {
  produtoId: string;
  quantidade: number;
  cor?: CorArte;
  /** O cadastro de onde a placa saiu, criado quando o item entrou no carrinho. */
  negocioId?: string;
  nomeNegocio?: string;
  linkAvaliacao?: string;
  placeId?: string;
};

export type PedidoDoCarrinho = {
  clienteId: string;
  forma: FormaCombinada;
  momento: MomentoPagamento;
  /** Desligado, o pedido fecha calado e a mensagem espera na tela do pedido. */
  avisarCliente: boolean;
  observacoes?: string;
  itens: ItemParaPedido[];
};

// Toda regra daqui leva a frase escrita, e nenhuma fica com a do zod.
//
// O que sobrava do padrao ia inteiro para o toast do vendedor: um carrinho com
// uma linha estragada fechava a venda com "Invalid UUID" na tela, que nao diz
// nem qual item nem o que fazer. Estes campos nao sao digitados por ninguem —
// vem do carrinho no navegador — entao o unico conserto possivel e tirar o item
// e adicionar de novo, e e isso que a frase manda fazer.
const QUANTIDADE = "A quantidade precisa ser um número de 1 a 999.";
const REFAZER = "Remova o item e adicione de novo.";

const esquema = z.object({
  clienteId: z.string().uuid("Escolha o cliente do pedido."),
  forma: z.enum(["pix", "dinheiro"], "Escolha a forma de pagamento."),
  momento: z.enum(["agora", "na_entrega"], "Diga se o cliente paga agora ou na entrega."),
  avisarCliente: z.boolean(),
  observacoes: z.string().trim().max(500, "A observação passou de 500 caracteres.").optional(),
  itens: z
    .array(
      z.object({
        produtoId: z.string().uuid(`O produto não foi reconhecido. ${REFAZER}`),
        quantidade: z.coerce
          .number(QUANTIDADE)
          .int(QUANTIDADE)
          .min(1, QUANTIDADE)
          .max(999, QUANTIDADE),
        cor: z.enum(CORES, `A cor não é mais vendida. ${REFAZER}`).optional(),
        negocioId: z.string().uuid(`O negócio não ficou cadastrado. ${REFAZER}`).optional(),
        nomeNegocio: z
          .string()
          .trim()
          .min(2, "Falta o nome do negócio que vai impresso na placa.")
          .optional(),
        linkAvaliacao: z.string().trim().min(1, "Falta o link de avaliação da placa.").optional(),
        placeId: z.string().trim().optional(),
      }),
    )
    .min(1, "O carrinho está vazio."),
});

/**
 * O primeiro problema do carrinho, dizendo de qual item ele e.
 *
 * Sem a posicao, um carrinho de quatro placas devolvia uma frase sobre "o item"
 * e deixava o vendedor conferindo os quatro com o cliente esperando. O caminho
 * que o zod ja monta sabe qual linha falhou: `itens[2]` e a terceira da gaveta.
 */
function avisoDoPedido(erro: {
  issues: Array<{ path: PropertyKey[]; message: string }>;
}): string {
  const problema = erro.issues[0];
  if (!problema) return "Confira os itens do pedido.";

  const [campo, indice] = problema.path;
  if (campo === "itens" && typeof indice === "number") {
    return `Item ${indice + 1} do carrinho: ${problema.message}`;
  }

  return problema.message;
}

type ProdutoDaVenda = {
  id: string;
  tipo: "avaliacao" | "padrao";
  nome: string;
  preco_centavos: number;
  prazo_entrega_dias: number;
  produto_avaliacao: Pick<
    ProdutoAvaliacao,
    | "largura_mm"
    | "altura_mm"
    | "margem_seguranca_mm"
    | "sangria_mm"
    | "dpi"
    | "cores"
    | "tecnologia"
  > | null;
};

/**
 * Passo 1: o carrinho vira pedido gravado.
 *
 * E o unico passo que pode dizer nao. Tudo que da para recusar uma venda —
 * produto que saiu do catalogo, cor que nao existe mais, link que nao e do
 * Google, cliente que sumiu da lista — e conferido aqui, antes de existir
 * qualquer linha no banco. Depois daqui o pedido existe, e nenhum dos outros
 * dois passos tem o direito de derrubar a venda.
 *
 * Recebe objeto e nao `FormData`: o carrinho e uma lista de itens, e serializar
 * lista em campo escondido so para caber num formulario seria trabalho a toa.
 *
 * O total do pedido nao e calculado aqui: quem soma os itens e o gatilho
 * `recalcular_pedido`, e quem carimba a comissao de cada linha e o
 * `carimbar_item_do_pedido`. Preco que chega do navegador nunca e usado, so o
 * que esta no produto no banco.
 */
export async function abrirPedido(entrada: PedidoDoCarrinho): Promise<AberturaDoPedido> {
  const resultado = esquema.safeParse(entrada);
  if (!resultado.success) {
    return { erro: avisoDoPedido(resultado.error) };
  }

  const { clienteId, forma, momento, avisarCliente, observacoes, itens } = resultado.data;

  const sessao = await sessaoDoPainel();
  if (!sessao?.perfil.assinatura_id) return { erro: "Sessão expirada. Entre de novo." };

  const assinaturaId = sessao.perfil.assinatura_id;
  const supabase = await createClient();

  // O `negocio_id` chega do navegador e a chave estrangeira sozinha nao confere
  // conta nenhuma: ela aceitaria o id de um negocio de outro assinante. Esta
  // consulta passa pela RLS, entao o que nao voltar aqui e o que esta pessoa
  // nao pode ver — e vira nulo, sem derrubar a venda. O que foi impresso nao
  // depende disto: nome e link vao carimbados no proprio item.
  const idsDeNegocio = itens.map((item) => item.negocioId).filter(Boolean) as string[];

  // As tres conferencias sao independentes e por isso saem juntas.
  //
  // Uma de cada vez eram tres idas em fila no comeco do fechamento, que ja e a
  // tela mais lenta do sistema — grava, desenha a arte de cada placa, monta o
  // PIX e ainda chama o WhatsApp antes de sair do lugar. Quem confere o que
  // voltou continua conferindo na mesma ordem de antes, entao o vendedor que
  // errar duas coisas ao mesmo tempo le o mesmo aviso que lia.
  const [{ data: catalogo }, { data: cliente }, { data: agenda }] = await Promise.all([
    supabase
      .from("produtos")
      .select(
        `id, tipo, nome, preco_centavos, prazo_entrega_dias, ${detalheDaPlaca("largura_mm, altura_mm, margem_seguranca_mm, sangria_mm, dpi, cores, tecnologia")}`,
      )
      .in(
        "id",
        itens.map((item) => item.produtoId),
      )
      .eq("ativo", true)
      .returns<ProdutoDaVenda[]>(),
    supabase.from("clientes").select("id, nome").eq("id", clienteId).single(),
    idsDeNegocio.length > 0
      ? supabase.from("negocios").select("id").in("id", idsDeNegocio)
      : Promise.resolve({ data: [] as Array<{ id: string }> }),
  ]);

  const porId = new Map((catalogo ?? []).map((produto) => [produto.id, produto]));

  if (porId.size !== new Set(itens.map((item) => item.produtoId)).size) {
    return { erro: "Um dos produtos do carrinho saiu do catálogo. Revise os itens." };
  }

  // O que o navegador mandou so vale se o produto ainda oferecer aquilo. Sem
  // esta conferencia, um carrinho velho geraria arte numa cor que saiu de linha.
  const links: Array<string | null> = [];

  for (const item of itens) {
    const produto = porId.get(item.produtoId)!;
    const placa = produto.produto_avaliacao;

    if (produto.tipo === "avaliacao") {
      if (!placa) return { erro: `${produto.nome} está sem medidas cadastradas.` };
      if (!item.nomeNegocio || !item.linkAvaliacao) {
        return { erro: `${produto.nome} precisa do nome do negócio e do link de avaliação.` };
      }
      if (!item.cor || !placa.cores.includes(item.cor)) {
        return { erro: `${produto.nome} não é mais vendido nessa cor. Revise o carrinho.` };
      }

      const link = validarLinkAvaliacao(item.linkAvaliacao);
      if (!link) {
        return {
          erro: `O link de "${item.nomeNegocio}" não parece do Google. Use o link de avaliação do perfil.`,
        };
      }
      links.push(link);
    } else {
      links.push(null);
    }
  }

  if (!cliente) return { erro: "Esse cliente não está mais na sua lista." };

  const negociosValidos = new Set((agenda ?? []).map((linha) => linha.id));

  const { data: pedido, error: erroPedido } = await supabase
    .from("pedidos")
    .insert({
      assinatura_id: assinaturaId,
      cliente_id: clienteId,
      criado_por: sessao.perfil.id,
      origem: "painel",
      forma_combinada: forma,
      momento_pagamento: momento,
      observacoes: observacoes || null,
    })
    .select("id, codigo")
    .single();

  if (erroPedido || !pedido) {
    return { erro: "Não consegui abrir o pedido. Tente de novo." };
  }

  const linhas = itens.map((item, indice) => {
    const produto = porId.get(item.produtoId)!;
    const ehPlaca = produto.tipo === "avaliacao";

    return {
      pedido_id: pedido.id,
      ordem: indice + 1,
      produto_id: produto.id,
      tipo: produto.tipo,
      nome_negocio: ehPlaca ? item.nomeNegocio! : null,
      link_avaliacao: links[indice],
      google_place_id: ehPlaca ? item.placeId || null : null,
      negocio_id:
        ehPlaca && item.negocioId && negociosValidos.has(item.negocioId) ? item.negocioId : null,
      produto_nome: produto.nome,
      cor: ehPlaca ? item.cor! : null,
      // A tecnologia vem do produto, e nao do carrinho: e o produto que decide,
      // do mesmo jeito que o preco.
      tecnologia: ehPlaca ? produto.produto_avaliacao!.tecnologia : null,
      quantidade: item.quantidade,
      preco_unitario_centavos: produto.preco_centavos,
      prazo_entrega_dias: produto.prazo_entrega_dias,
      arte_jpg_path: null,
      arte_preview_path: null,
    };
  });

  const { error: erroItens } = await supabase.from("pedido_itens").insert(linhas);

  if (erroItens) {
    // Pedido sem item nenhum e lixo com codigo gasto: melhor apagar.
    await supabase.from("pedidos").delete().eq("id", pedido.id);
    return { erro: "Não consegui gravar os itens do pedido. Tente de novo." };
  }

  // O evento entra aqui, e nao no fim: e o registro de que o pedido nasceu, e
  // ele nasceu neste passo. Um fechamento que parar no desenho da arte continua
  // tendo no historico quem vendeu, para quem, e o que ficou combinado.
  await supabase.from("pedido_eventos").insert({
    pedido_id: pedido.id,
    tipo: "criado",
    de: null,
    para: "novo",
    detalhe: `Pedido aberto no painel por ${sessao.perfil.nome} para ${cliente.nome}. Combinado: ${forma === "pix" ? "PIX" : "dinheiro"}, ${momento === "agora" ? "paga agora" : "paga na entrega"}.${avisarCliente ? "" : " Cliente nao avisado no fechamento."}`,
    autor_id: sessao.perfil.id,
  });

  return {
    pedido: {
      pedidoId: pedido.id,
      codigo: pedido.codigo,
      placas: linhas.filter((linha) => linha.tipo === "avaliacao").map((linha) => linha.ordem),
    },
  };
}

/**
 * Passo 2: a arte de uma placa do pedido.
 *
 * Uma por chamada, e nao todas de uma vez, porque e disso que sai o "2 de 3" da
 * tela: o contador anda quando a placa esta gravada, e nao quando um cronometro
 * acha que deveria. O laco em si mora em `lib/art/pedido`, junto do botao de
 * gerar de novo da tela do pedido.
 *
 * O que volta e uma contagem, e nao um erro: placa que nao saiu nao cancela
 * venda nenhuma. Quem chamou decide o que dizer, e a tela do pedido ja mostra
 * "Arte ainda nao gerada" com o botao ao lado.
 */
export async function desenharArtes(
  pedidoId: string,
  ordem: number,
): Promise<ArtesDoFechamento> {
  if (!z.string().uuid().safeParse(pedidoId).success) {
    return { total: 0, feitas: 0, erro: "Pedido inválido." };
  }

  return await gerarArtesDoPedido(pedidoId, { ordem });
}

/**
 * Passo 3: a cobranca e a mensagem.
 *
 * O PIX so pode ser montado agora, e nao junto com o pedido: quem soma o total
 * e o gatilho que roda no insert dos itens, e um BR Code com o total zerado nao
 * cobra nada.
 *
 * A cobranca e gravada mesmo com o aviso desligado. O codigo carrega o total
 * daquele fechamento, e quem apertar "Mandar as artes no WhatsApp" amanha
 * precisa achar a cobranca pronta em vez de um pedido sem PIX nenhum.
 *
 * O combinado vem da linha do pedido, e nao do navegador: e a mesma leitura que
 * o reenvio da tela do pedido faz, entao a segunda mensagem nunca contradiz a
 * primeira.
 */
export async function cobrarEAvisar(entrada: {
  pedidoId: string;
  avisarCliente: boolean;
}): Promise<{ envio: DesfechoDoEnvio }> {
  if (!z.string().uuid().safeParse(entrada.pedidoId).success) return { envio: "nao" };

  const supabase = await createClient();

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("id, codigo, forma_combinada, momento_pagamento")
    .eq("id", entrada.pedidoId)
    .single();

  if (!pedido) return { envio: "nao" };

  const temPix = await prepararCobranca({
    supabase,
    pedidoId: pedido.id,
    codigo: pedido.codigo,
    cobrarAgora: pedido.forma_combinada === "pix" && pedido.momento_pagamento === "agora",
  });

  if (!entrada.avisarCliente) return { envio: "nao" };

  // A arte sai junto da mensagem. Se nao houver instancia conectada, a pagina
  // do pedido mostra o botao que abre o WhatsApp com o texto pronto.
  const envio = await enviarWhatsapp(
    pedido.id,
    chaveDoFechamento({
      forma: pedido.forma_combinada,
      momento: pedido.momento_pagamento,
      temPix,
    }),
  );

  return { envio: envio.enviado ? "ok" : "link" };
}

/**
 * Monta o PIX copia e cola do pedido e diz se ele ficou gravado.
 *
 * So gera quando o combinado foi PIX a vista. Falta de chave PIX na conta nao
 * derruba nada: o pedido ja esta fechado, e mandar a mensagem sem a cobranca e
 * muito melhor do que perder a venda porque o assinante nao preencheu Ajustes.
 * Quem avisa disso e a propria tela de fechamento, antes de confirmar.
 *
 * O `false` que sai daqui e o que faz `chaveDoFechamento` recuar para o texto
 * generico: o modelo do PIX a vista termina no copia e cola, e sem codigo na
 * coluna ele acabaria com a ultima linha em branco.
 */
async function prepararCobranca({
  supabase,
  pedidoId,
  codigo,
  cobrarAgora,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  pedidoId: string;
  codigo: string;
  cobrarAgora: boolean;
}): Promise<boolean> {
  if (!cobrarAgora) return false;

  // Pela funcao, e nao pela tabela: `configuracoes` so abre para o assinante, e
  // quem mais fecha pedido e o vendedor.
  const [{ data: pix }, { data: pedido }] = await Promise.all([
    supabase.rpc("pix_da_conta").maybeSingle(),
    supabase.from("pedidos").select("total_centavos").eq("id", pedidoId).single(),
  ]);

  const codigoPix = pixCopiaECola(
    {
      chave: pix?.pix_chave ?? undefined,
      beneficiario: pix?.pix_beneficiario ?? undefined,
      cidade: pix?.pix_cidade ?? undefined,
    },
    pedido?.total_centavos ?? 0,
    codigo,
  );

  if (!codigoPix) return false;

  const { error } = await supabase
    .from("pedidos")
    .update({ pix_copia_e_cola: codigoPix })
    .eq("id", pedidoId);

  // A mensagem le o codigo da coluna, e nao esta variavel: se a gravacao falhou,
  // nao ha cobranca para mandar por mais que o BR Code tenha sido montado aqui.
  return !error;
}

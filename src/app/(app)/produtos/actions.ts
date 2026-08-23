"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ACABAMENTO_PADRAO, CORES, TAMANHOS, TECNOLOGIAS } from "@/lib/catalogo";
import { contaDoDono } from "@/lib/supabase/dono";
import { createClient } from "@/lib/supabase/server";

export type EstadoProduto = { erro?: string; sucesso?: string };

const reais = z
  .string()
  .trim()
  .transform((texto) => Number(texto.replace(/\./g, "").replace(",", ".")))
  .pipe(z.number().min(0, "Preço não pode ser negativo.").max(99999));

const medida = z
  .string()
  .trim()
  .transform((texto) => Number(texto.replace(",", ".")))
  .pipe(z.number());

const esquemaProduto = z.object({
  id: z.string().uuid().optional(),
  tipo: z.enum(["avaliacao", "padrao"]),
  nome: z.string().trim().min(1, "Digite o nome do produto.").max(80),
  descricao: z.string().trim().max(500).optional(),
  preco: reais,
  comissao: medida.pipe(
    z.number().min(0, "Comissão não pode ser negativa.").max(100, "Comissão passa de 100%."),
  ),
  prazoEntrega: z.coerce.number().int().min(0).max(365),
});

/** O que a placa oferece na venda, e em que formato ela e cortada. */
const esquemaPlaca = z.object({
  cores: z.array(z.enum(CORES)).min(1, "Escolha pelo menos uma cor."),
  tecnologia: z.enum(TECNOLOGIAS),
});

/** So chega a ser lido quando o tamanho e "personalizado". */
const esquemaMedidasProprias = z.object({
  largura: medida.pipe(z.number().min(10, "Largura muito pequena.").max(2000)),
  altura: medida.pipe(z.number().min(10, "Altura muito pequena.").max(2000)),
  margem: medida.pipe(z.number().min(0).max(100)),
  sangria: medida.pipe(z.number().min(0).max(100)),
  dpi: z.coerce.number().int().min(72).max(1200),
});

const esquemaTamanho = z.enum(["a6", "a5", "personalizado"]);

/** 5 MB: foto de produto tirada no celular cabe folgada, e o bucket nao incha. */
const TAMANHO_MAXIMO_FOTO = 5 * 1024 * 1024;

type Medidas = {
  largura_mm: number;
  altura_mm: number;
  margem_seguranca_mm: number;
  sangria_mm: number;
  dpi: number;
};

/**
 * Salva um produto e, quando for placa, as medidas dele.
 *
 * As duas tabelas num formulario so: produto de avaliacao sem medida nao gera
 * arte, entao separar as telas criaria um estado intermediario em que o
 * catalogo existe mas a venda quebra no fechamento do pedido.
 *
 * `ativo` nao entra aqui. Produto novo nasce ativo pelo default do banco, e
 * ligar ou desligar e o interruptor da lista: uma decisao, um lugar so.
 */
export async function salvarProduto(
  _estado: EstadoProduto,
  dados: FormData,
): Promise<EstadoProduto> {
  const resultado = esquemaProduto.safeParse({
    id: dados.get("id") || undefined,
    tipo: dados.get("tipo"),
    nome: dados.get("nome"),
    descricao: dados.get("descricao") || undefined,
    preco: dados.get("preco"),
    comissao: dados.get("comissao") ?? "0",
    prazoEntrega: dados.get("prazo") ?? 3,
  });

  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Confira os dados do produto." };
  }

  const produto = resultado.data;
  const ehPlaca = produto.tipo === "avaliacao";

  if (!ehPlaca && !produto.descricao) {
    return { erro: "Produto padrão precisa de descrição: é o que o cliente lê na venda." };
  }

  let placa: (z.infer<typeof esquemaPlaca> & Medidas) | null = null;

  if (ehPlaca) {
    const oferta = esquemaPlaca.safeParse({
      cores: dados.getAll("cores"),
      tecnologia: dados.get("tecnologia"),
    });

    if (!oferta.success) {
      return { erro: oferta.error.issues[0]?.message ?? "Confira as opções da placa." };
    }

    const medidas = medidasDoTamanho(dados);
    if ("erro" in medidas) return { erro: medidas.erro };

    placa = { ...oferta.data, ...medidas };
  }

  const assinaturaId = await contaDoDono();
  if (!assinaturaId) return { erro: "Só o dono da conta mexe no catálogo." };

  const supabase = await createClient();
  const linha = {
    tipo: produto.tipo,
    nome: produto.nome,
    descricao: produto.descricao || null,
    preco_centavos: Math.round(produto.preco * 100),
    comissao_percentual: produto.comissao,
    prazo_entrega_dias: produto.prazoEntrega,
  };

  let produtoId = produto.id;

  if (produtoId) {
    const { error } = await supabase.from("produtos").update(linha).eq("id", produtoId);
    if (error) return { erro: motivo(error, "Não consegui salvar o produto.") };
  } else {
    const { data: criado, error } = await supabase
      .from("produtos")
      .insert({ ...linha, assinatura_id: assinaturaId })
      .select("id")
      .single();

    if (error || !criado) return { erro: motivo(error, "Não consegui criar o produto.") };
    produtoId = criado.id;
  }

  if (placa) {
    const { error } = await supabase.from("produto_avaliacao").upsert(
      {
        produto_id: produtoId,
        assinatura_id: assinaturaId,
        largura_mm: placa.largura_mm,
        altura_mm: placa.altura_mm,
        margem_seguranca_mm: placa.margem_seguranca_mm,
        sangria_mm: placa.sangria_mm,
        dpi: placa.dpi,
        cores: placa.cores,
        tecnologia: placa.tecnologia,
      },
      { onConflict: "produto_id" },
    );

    if (error) return { erro: "Salvei o produto, mas não consegui salvar as medidas." };
  } else {
    const erroDaFoto = await guardarFoto(supabase, assinaturaId, produtoId, dados.get("foto"));
    if (erroDaFoto) return { erro: erroDaFoto };
  }

  revalidatePath("/produtos");
  revalidatePath("/vender");
  return { sucesso: `${linha.nome} salvo.` };
}

/**
 * As medidas do tamanho escolhido.
 *
 * Em A6 e A5 as medidas vem da constante, e nao dos campos: eles chegam so de
 * leitura na tela, e o que a tela mostra travado o navegador continua podendo
 * reescrever. Digitar medida so acontece de verdade em "personalizado".
 */
function medidasDoTamanho(dados: FormData): Medidas | { erro: string } {
  const tamanho = esquemaTamanho.safeParse(dados.get("tamanho"));
  if (!tamanho.success) return { erro: "Escolha o tamanho da placa." };

  if (tamanho.data !== "personalizado") {
    const { largura_mm, altura_mm } = TAMANHOS[tamanho.data];
    return { largura_mm, altura_mm, ...ACABAMENTO_PADRAO };
  }

  const proprias = esquemaMedidasProprias.safeParse({
    largura: dados.get("largura"),
    altura: dados.get("altura"),
    margem: dados.get("margem") ?? String(ACABAMENTO_PADRAO.margem_seguranca_mm),
    sangria: dados.get("sangria") ?? String(ACABAMENTO_PADRAO.sangria_mm),
    dpi: dados.get("dpi") ?? ACABAMENTO_PADRAO.dpi,
  });

  if (!proprias.success) {
    return { erro: proprias.error.issues[0]?.message ?? "Confira as medidas da placa." };
  }

  return {
    largura_mm: proprias.data.largura,
    altura_mm: proprias.data.altura,
    margem_seguranca_mm: proprias.data.margem,
    sangria_mm: proprias.data.sangria,
    dpi: proprias.data.dpi,
  };
}

/**
 * Liga e desliga o produto na venda, direto da lista.
 *
 * E o unico caminho para esse campo: o popup de cadastro nao tem "ativo", e
 * produto novo nasce valendo. Tirar da venda e decisao de um toque, e nao
 * motivo para abrir um formulario inteiro.
 */
export async function alternarProduto(id: string, ativo: boolean): Promise<EstadoProduto> {
  if (!z.string().uuid().safeParse(id).success) return { erro: "Produto inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("produtos")
    .update({ ativo })
    .eq("id", id)
    .select("nome")
    .single();

  if (error || !data) return { erro: "Não consegui mudar este produto." };

  revalidatePath("/produtos");
  revalidatePath("/vender");
  return { sucesso: ativo ? `${data.nome} voltou para a venda.` : `${data.nome} saiu da venda.` };
}

/**
 * Sobe a foto do produto e grava o caminho.
 *
 * Devolve a mensagem de erro em vez de lancar: o produto ja esta salvo neste
 * ponto, e derrubar a action faria o assinante achar que perdeu o cadastro
 * inteiro por causa de uma imagem.
 */
async function guardarFoto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assinaturaId: string,
  produtoId: string,
  enviado: FormDataEntryValue | null,
): Promise<string | null> {
  if (!(enviado instanceof File) || enviado.size === 0) return null;

  if (!enviado.type.startsWith("image/")) {
    return "Salvei o produto, mas a foto precisa ser uma imagem.";
  }

  if (enviado.size > TAMANHO_MAXIMO_FOTO) {
    return "Salvei o produto, mas a foto passa de 5 MB.";
  }

  const extensao = enviado.type === "image/png" ? "png" : "jpg";
  const caminho = `${assinaturaId}/${produtoId}.${extensao}`;

  const { error } = await supabase.storage
    .from("produtos")
    .upload(caminho, enviado, { contentType: enviado.type, upsert: true });

  if (error) return "Salvei o produto, mas não consegui subir a foto.";

  const { error: erroDoCaminho } = await supabase
    .from("produtos")
    .update({ foto_path: caminho })
    .eq("id", produtoId);

  return erroDoCaminho ? "Subi a foto, mas não consegui ligá-la ao produto." : null;
}

export async function removerProduto(
  _estado: EstadoProduto,
  dados: FormData,
): Promise<EstadoProduto> {
  const id = String(dados.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success) return { erro: "Produto inválido." };

  const supabase = await createClient();
  const { error } = await supabase.from("produtos").delete().eq("id", id);

  if (error) {
    // Produto usado em pedido tem ON DELETE RESTRICT: apagar levaria embora o
    // retrato da venda. Desligar resolve o mesmo problema sem perder historico.
    return {
      erro:
        error.code === "23503"
          ? "Este produto já foi vendido. Desligue-o na lista para tirá-lo da venda."
          : "Não consegui remover este produto.",
    };
  }

  revalidatePath("/produtos");
  revalidatePath("/vender");
  return { sucesso: "Produto removido." };
}

function motivo(error: { code?: string } | null, padrao: string): string {
  if (error?.code === "23505") return "Já existe um produto com esse nome na sua conta.";
  return padrao;
}

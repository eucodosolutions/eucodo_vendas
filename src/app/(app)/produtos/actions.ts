"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { CORES, TECNOLOGIAS } from "@/lib/catalogo";
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
  codigo: z
    .string()
    .trim()
    .min(1, "Digite um código para o produto.")
    .max(12)
    .regex(/^[A-Za-z0-9-]+$/, "O código aceita letras, números e hífen."),
  nome: z.string().trim().min(1, "Digite o nome do produto."),
  descricao: z.string().trim().max(500).optional(),
  preco: reais,
  comissao: medida.pipe(
    z.number().min(0, "Comissão não pode ser negativa.").max(100, "Comissão passa de 100%."),
  ),
  prazoEntrega: z.coerce.number().int().min(0).max(365),
  ativo: z.coerce.boolean(),
});

const esquemaPlaca = z.object({
  largura: medida.pipe(z.number().min(10, "Largura muito pequena.").max(2000)),
  altura: medida.pipe(z.number().min(10, "Altura muito pequena.").max(2000)),
  margem: medida.pipe(z.number().min(0).max(100)),
  sangria: medida.pipe(z.number().min(0).max(100)),
  dpi: z.coerce.number().int().min(72).max(1200),
  cores: z.array(z.enum(CORES)).min(1, "Escolha pelo menos uma cor."),
  tecnologias: z.array(z.enum(TECNOLOGIAS)).min(1, "Escolha pelo menos uma tecnologia."),
});

/** 5 MB: foto de produto tirada no celular cabe folgada, e o bucket nao incha. */
const TAMANHO_MAXIMO_FOTO = 5 * 1024 * 1024;

/**
 * Salva um produto e, quando for placa, as medidas dele.
 *
 * As duas tabelas num formulario so: produto de avaliacao sem medida nao gera
 * arte, entao separar as telas criaria um estado intermediario em que o
 * catalogo existe mas a venda quebra no fechamento do pedido.
 */
export async function salvarProduto(
  _estado: EstadoProduto,
  dados: FormData,
): Promise<EstadoProduto> {
  const resultado = esquemaProduto.safeParse({
    id: dados.get("id") || undefined,
    tipo: dados.get("tipo"),
    codigo: dados.get("codigo"),
    nome: dados.get("nome"),
    descricao: dados.get("descricao") || undefined,
    preco: dados.get("preco"),
    comissao: dados.get("comissao") ?? "0",
    prazoEntrega: dados.get("prazo") ?? 3,
    ativo: dados.get("ativo") === "on",
  });

  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Confira os dados do produto." };
  }

  const produto = resultado.data;
  const ehPlaca = produto.tipo === "avaliacao";

  if (!ehPlaca && !produto.descricao) {
    return { erro: "Produto padrão precisa de descrição: é o que o cliente lê na venda." };
  }

  let placa: z.infer<typeof esquemaPlaca> | null = null;

  if (ehPlaca) {
    const medidas = esquemaPlaca.safeParse({
      largura: dados.get("largura"),
      altura: dados.get("altura"),
      margem: dados.get("margem") ?? "7",
      sangria: dados.get("sangria") ?? "0",
      dpi: dados.get("dpi") ?? 300,
      cores: dados.getAll("cores"),
      tecnologias: dados.getAll("tecnologias"),
    });

    if (!medidas.success) {
      return { erro: medidas.error.issues[0]?.message ?? "Confira as medidas da placa." };
    }
    placa = medidas.data;
  }

  const assinaturaId = await contaDoDono();
  if (!assinaturaId) return { erro: "Só o dono da conta mexe no catálogo." };

  const supabase = await createClient();
  const linha = {
    tipo: produto.tipo,
    codigo: produto.codigo.toUpperCase(),
    nome: produto.nome,
    descricao: produto.descricao || null,
    preco_centavos: Math.round(produto.preco * 100),
    comissao_percentual: produto.comissao,
    prazo_entrega_dias: produto.prazoEntrega,
    ativo: produto.ativo,
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
        largura_mm: placa.largura,
        altura_mm: placa.altura,
        margem_seguranca_mm: placa.margem,
        sangria_mm: placa.sangria,
        dpi: placa.dpi,
        cores: placa.cores,
        tecnologias: placa.tecnologias,
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
          ? "Este produto já foi vendido. Desmarque “Ativo na venda” para tirá-lo do catálogo."
          : "Não consegui remover este produto.",
    };
  }

  revalidatePath("/produtos");
  revalidatePath("/vender");
  return { sucesso: "Produto removido." };
}

function motivo(error: { code?: string } | null, padrao: string): string {
  if (error?.code === "23505") return "Já existe um produto com esse código na sua conta.";
  return padrao;
}

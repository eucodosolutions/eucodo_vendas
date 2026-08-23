"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { normalizarWhatsapp, validarLinkAvaliacao } from "@/lib/formato";
import { sessaoDoPainel } from "@/lib/supabase/painel";
import { createClient } from "@/lib/supabase/server";

export type EstadoCliente = {
  erro?: string;
  sucesso?: string;
  /** Preenchido no cadastro, para quem chamou saber com quem seguir. */
  clienteId?: string;
};

const esquema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(2, "Digite o nome do cliente."),
  whatsapp: z.string().trim().min(1, "Digite o WhatsApp do cliente."),
  linkAvaliacao: z.string().trim().optional(),
  observacoes: z.string().trim().max(500).optional(),
});

type DadosDoCliente = z.infer<typeof esquema>;

/**
 * Cadastra ou atualiza um cliente.
 *
 * Quem pode o que fica na RLS, e nao em `if` aqui: o vendedor tem policy de
 * insert e nao tem de update, entao a edicao dele volta como erro do banco
 * mesmo que alguem chame esta acao por fora da tela.
 */
export async function salvarCliente(
  _estado: EstadoCliente,
  dados: FormData,
): Promise<EstadoCliente> {
  const resultado = esquema.safeParse({
    id: dados.get("id") || undefined,
    nome: dados.get("nome"),
    whatsapp: dados.get("whatsapp"),
    linkAvaliacao: dados.get("linkAvaliacao") || undefined,
    observacoes: dados.get("observacoes") || undefined,
  });

  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Confira os dados do cliente." };
  }

  return await gravar(resultado.data);
}

/** Mesmo caminho, chamado de dentro do carrinho, sem passar por formulario. */
export async function cadastrarClienteRapido(dados: {
  nome: string;
  whatsapp: string;
}): Promise<EstadoCliente> {
  const resultado = esquema.safeParse(dados);
  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Confira os dados do cliente." };
  }
  return await gravar(resultado.data);
}

async function gravar(dados: DadosDoCliente): Promise<EstadoCliente> {
  const whatsapp = normalizarWhatsapp(dados.whatsapp);
  if (!whatsapp) {
    return { erro: "Esse WhatsApp não parece válido. Confira o DDD e o número." };
  }

  let link: string | null = null;
  if (dados.linkAvaliacao) {
    link = validarLinkAvaliacao(dados.linkAvaliacao);
    if (!link) {
      return { erro: "Esse link não parece do Google. Use o link de avaliação do perfil." };
    }
  }

  const sessao = await sessaoDoPainel();
  if (!sessao?.perfil.assinatura_id) return { erro: "Sessão expirada. Entre de novo." };

  const supabase = await createClient();

  const campos = {
    nome: dados.nome,
    whatsapp,
    link_avaliacao: link,
    observacoes: dados.observacoes || null,
  };

  if (dados.id) {
    const { error } = await supabase.from("clientes").update(campos).eq("id", dados.id);

    if (error) return { erro: motivo(error, "Não consegui salvar as alterações.") };

    revalidatePath("/clientes");
    revalidatePath(`/clientes/${dados.id}`);
    return { sucesso: `${dados.nome} atualizado.`, clienteId: dados.id };
  }

  const { data: criado, error } = await supabase
    .from("clientes")
    .insert({
      ...campos,
      assinatura_id: sessao.perfil.assinatura_id,
      criado_por: sessao.perfil.id,
    })
    .select("id")
    .single();

  if (error || !criado) return { erro: motivo(error, "Não consegui cadastrar o cliente.") };

  revalidatePath("/clientes");
  return { sucesso: `${dados.nome} cadastrado.`, clienteId: criado.id };
}

export async function removerCliente(
  _estado: EstadoCliente,
  dados: FormData,
): Promise<EstadoCliente> {
  const id = String(dados.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success) return { erro: "Cliente inválido." };

  const supabase = await createClient();
  const { error } = await supabase.from("clientes").delete().eq("id", id);

  if (error) {
    // Pedido aponta para cliente com ON DELETE RESTRICT: apagar quem ja comprou
    // apagaria o historico da venda junto.
    return {
      erro:
        error.code === "23503"
          ? "Este cliente já tem pedido no sistema e por isso não pode ser removido."
          : "Não consegui remover este cliente.",
    };
  }

  revalidatePath("/clientes");
  return { sucesso: "Cliente removido." };
}

function motivo(error: { code?: string } | null, padrao: string): string {
  if (error?.code === "23505") return "Já existe um cliente com esse WhatsApp na sua conta.";
  if (error?.code === "42501") return "Só o dono da conta edita cliente.";
  return padrao;
}

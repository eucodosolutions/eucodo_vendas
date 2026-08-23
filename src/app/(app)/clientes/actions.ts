"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { normalizarWhatsapp } from "@/lib/formato";
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
  observacoes: z.string().trim().max(500).optional(),
});

type DadosDoCliente = z.infer<typeof esquema>;

/**
 * Cadastra ou atualiza um cliente.
 *
 * Quem pode o que fica na RLS, e nao em `if` aqui: a policy deixa o dono da
 * conta e quem cadastrou mexerem na linha, entao chamar esta acao por fora da
 * tela nao alcanca o cliente de outra pessoa da equipe.
 */
export async function salvarCliente(
  _estado: EstadoCliente,
  dados: FormData,
): Promise<EstadoCliente> {
  const resultado = esquema.safeParse({
    id: dados.get("id") || undefined,
    nome: dados.get("nome"),
    whatsapp: dados.get("whatsapp"),
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

  const sessao = await sessaoDoPainel();
  if (!sessao?.perfil.assinatura_id) return { erro: "Sessão expirada. Entre de novo." };

  const supabase = await createClient();

  // `link_avaliacao` e `google_place_id` ficaram de fora de proposito. Nao e so
  // que o cadastro nao os pede mais: listar aqui como null apagaria, em toda
  // edicao de cliente, o que ficou gravado antes de o link virar coisa do item.
  const campos = {
    nome: dados.nome,
    whatsapp,
    observacoes: dados.observacoes || null,
  };

  if (dados.id) {
    // O `select` nao e enfeite: quando a policy barra a linha, o update nao
    // levanta erro nenhum, so nao altera nada. Sem conferir o que voltou, o
    // vendedor tentando mexer no cliente de outro receberia "atualizado".
    const { data: alterado, error } = await supabase
      .from("clientes")
      .update(campos)
      .eq("id", dados.id)
      .select("id")
      .maybeSingle();

    if (error) return { erro: motivo(error, "Não consegui salvar as alterações.") };
    if (!alterado) return { erro: SO_QUEM_CADASTROU };

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
  const { data: removido, error } = await supabase
    .from("clientes")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

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

  // Mesmo caso do update: linha barrada pela policy sai como zero linhas, e nao
  // como erro.
  if (!removido) return { erro: SO_QUEM_CADASTROU };

  revalidatePath("/clientes");
  return { sucesso: "Cliente removido." };
}

const SO_QUEM_CADASTROU =
  "Este cliente foi cadastrado por outra pessoa da equipe. Só quem cadastrou, ou o dono da conta, pode mexer nele.";

function motivo(error: { code?: string } | null, padrao: string): string {
  // A unicidade e por autor: o WhatsApp repetido que o banco recusa e sempre um
  // cliente que a propria pessoa ja tem cadastrado. O do colega nao atrapalha.
  if (error?.code === "23505") return "Você já cadastrou um cliente com esse WhatsApp.";
  if (error?.code === "42501") return SO_QUEM_CADASTROU;
  return padrao;
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { normalizarWhatsapp } from "@/lib/formato";
import { sessaoDoPainel } from "@/lib/supabase/painel";
import { createClient } from "@/lib/supabase/server";

/**
 * O acesso recem-criado volta uma vez so.
 *
 * A senha nao fica guardada em lugar nenhum: sai da Edge Function, aparece na
 * tela para o dono copiar e mandar no WhatsApp, e acabou. Se ele perder, o
 * caminho e gerar outra.
 */
export type Acesso = {
  id: string;
  nome: string;
  email: string;
  senha: string;
  whatsapp: string | null;
};

export type EstadoEquipe = {
  erro?: string;
  sucesso?: string;
  acesso?: Acesso;
};

const esquemaVendedor = z.object({
  nome: z.string().trim().min(2, "Digite o nome do vendedor."),
  email: z.string().trim().toLowerCase().email("Confira o e-mail do vendedor."),
  whatsapp: z.string().trim().min(1, "Digite o WhatsApp do vendedor."),
});

type RespostaAcesso = { id: string; nome: string; email: string; senha: string };

/** Quem manda na equipe e o dono da conta, nao o admin da plataforma. */
async function sessaoDeAssinante() {
  const supabase = await createClient();
  const sessao = await sessaoDoPainel();

  const dono =
    sessao?.perfil.papel === "assinante" && sessao.perfil.ativo ? sessao.perfil : null;

  return { supabase, dono };
}

/**
 * A Edge Function responde 4xx com o motivo no corpo, e o supabase-js embrulha
 * isso num erro generico. Sem abrir o corpo, todo problema viraria "tente de
 * novo" e o dono nao saberia que o e-mail ja existe.
 */
async function motivoDaFalha(erro: unknown): Promise<string> {
  const contexto = (erro as { context?: Response }).context;
  if (contexto && typeof contexto.json === "function") {
    try {
      const corpo = await contexto.json();
      if (corpo?.erro) return String(corpo.erro);
    } catch {
      // corpo vazio ou ja lido, cai no texto generico
    }
  }
  return "Não consegui falar com o servidor. Tente de novo em instantes.";
}

export async function cadastrarVendedor(
  _estado: EstadoEquipe,
  dados: FormData,
): Promise<EstadoEquipe> {
  const resultado = esquemaVendedor.safeParse({
    nome: dados.get("nome"),
    email: dados.get("email"),
    whatsapp: dados.get("whatsapp"),
  });

  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Confira os dados do vendedor." };
  }

  const whatsapp = normalizarWhatsapp(resultado.data.whatsapp);
  if (!whatsapp) {
    return { erro: "Esse WhatsApp não parece válido. Confira o DDD e o número." };
  }

  const { supabase, dono } = await sessaoDeAssinante();
  if (!dono) return { erro: "Só o dono da conta cadastra vendedor." };

  const { data, error } = await supabase.functions.invoke<RespostaAcesso>("equipe", {
    body: {
      acao: "criar",
      nome: resultado.data.nome,
      email: resultado.data.email,
      whatsapp,
    },
  });

  if (error || !data) return { erro: await motivoDaFalha(error) };

  revalidatePath("/equipe");

  return {
    sucesso: `${data.nome} já pode entrar. Mande o acesso antes de fechar esta tela.`,
    acesso: { ...data, whatsapp },
  };
}

export async function gerarNovaSenha(
  _estado: EstadoEquipe,
  dados: FormData,
): Promise<EstadoEquipe> {
  const vendedorId = String(dados.get("vendedorId") ?? "");
  if (!z.string().uuid().safeParse(vendedorId).success) {
    return { erro: "Vendedor inválido." };
  }

  const { supabase, dono } = await sessaoDeAssinante();
  if (!dono) return { erro: "Só o dono da conta troca a senha do vendedor." };

  const { data, error } = await supabase.functions.invoke<RespostaAcesso>("equipe", {
    body: { acao: "nova_senha", vendedorId },
  });

  if (error || !data) return { erro: await motivoDaFalha(error) };

  const { data: perfil } = await supabase
    .from("perfis")
    .select("whatsapp")
    .eq("id", vendedorId)
    .single();

  revalidatePath("/equipe");

  return {
    sucesso: `Senha nova para ${data.nome}. A anterior deixou de valer agora.`,
    acesso: { ...data, whatsapp: perfil?.whatsapp ?? null },
  };
}

export async function quitarComissoes(
  _estado: EstadoEquipe,
  dados: FormData,
): Promise<EstadoEquipe> {
  const vendedorId = String(dados.get("vendedorId") ?? "");
  if (!z.string().uuid().safeParse(vendedorId).success) return { erro: "Vendedor inválido." };

  const { supabase, dono } = await sessaoDeAssinante();
  if (!dono) return { erro: "Só o dono da conta quita comissão." };

  const { data, error } = await supabase
    .from("pedidos")
    .update({ comissao_paga_em: new Date().toISOString() })
    .eq("criado_por", vendedorId)
    .eq("pagamento", "pago")
    .neq("status", "cancelado")
    .is("comissao_paga_em", null)
    .gt("comissao_centavos", 0)
    .select("id");

  if (error) return { erro: "Não consegui registrar o acerto." };
  if (!data?.length) return { erro: "Não há comissão em aberto para acertar." };

  revalidatePath("/equipe");
  revalidatePath("/pedidos");

  return {
    sucesso: `${data.length} pedido${data.length > 1 ? "s" : ""} marcado${data.length > 1 ? "s" : ""} como pago ao vendedor.`,
  };
}

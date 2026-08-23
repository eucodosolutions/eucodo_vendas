"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { MOTIVO_DE_ACESSO } from "@/lib/acesso";
import { normalizarWhatsapp } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import type { PapelUsuario } from "@/types/database";

export type EstadoFormulario = {
  erro?: string;
  sucesso?: string;
};

const email = z.string().trim().toLowerCase().email("Confira o e-mail digitado.");
const senha = z.string().min(8, "A senha precisa de pelo menos 8 caracteres.");

const esquemaEntrada = z.object({
  email,
  senha: z.string().min(1, "Digite sua senha."),
});

const esquemaCadastro = z.object({
  nome: z.string().trim().min(2, "Digite seu nome."),
  negocio: z.string().trim().min(2, "Digite o nome do seu negócio."),
  email,
  whatsapp: z.string().trim().min(1, "Digite seu WhatsApp."),
  senha,
});

const esquemaEmail = z.object({ email });

const esquemaNovaSenha = z
  .object({ senha, confirmacao: z.string() })
  .refine((dados) => dados.senha === dados.confirmacao, {
    message: "As duas senhas precisam ser iguais.",
    path: ["confirmacao"],
  });

type Falha = { success: false; error: { issues: Array<{ message: string }> } };

function primeiroErro(resultado: { success: boolean }): string {
  if (resultado.success) return "";
  return (resultado as Falha).error.issues[0]?.message ?? "Confira os dados digitados.";
}

export async function entrar(
  _estado: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const resultado = esquemaEntrada.safeParse({
    email: dados.get("email"),
    senha: dados.get("senha"),
  });
  if (!resultado.success) return { erro: primeiroErro(resultado) };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: resultado.data.email,
    password: resultado.data.senha,
  });

  if (error || !data.user) {
    // Credencial errada e servidor fora do ar viram a mesma tela generica com
    // facilidade, e ai a pessoa fica tentando trocar a senha quando o problema
    // e configuracao.
    const falhaDeRede = error?.name === "AuthRetryableFetchError" || error?.status === 0;
    return {
      erro: falhaDeRede
        ? "Não consegui falar com o servidor. Confira a configuração do Supabase."
        : "E-mail ou senha não conferem.",
    };
  }

  // O cadastro e aberto, o acesso nao. Sao dois portoes: o perfil precisa estar
  // liberado, e a assinatura precisa estar ativa. Suspender uma conta derruba o
  // assinante e a equipe dele de uma vez.
  const { data: perfil } = await supabase
    .from("perfis")
    .select("papel, status, assinaturas (status)")
    .eq("id", data.user.id)
    .single<{ papel: PapelUsuario; status: string; assinaturas: { status: string } | null }>();

  if (!perfil || perfil.status !== "ativo") {
    await supabase.auth.signOut();
    return {
      erro:
        perfil?.status === "bloqueado"
          ? "Este acesso foi bloqueado. Fale com quem cuida da conta."
          : "Seu acesso ainda não foi liberado.",
    };
  }

  if (perfil.papel === "admin") redirect("/admin");

  const conta = perfil.assinaturas ? `conta_${perfil.assinaturas.status}` : null;

  if (conta !== "conta_ativa") {
    await supabase.auth.signOut();
    return { erro: MOTIVO_DE_ACESSO[conta ?? "conta_pendente"] ?? MOTIVO_DE_ACESSO.conta_pendente };
  }

  const proxima = String(dados.get("proxima") ?? "");
  redirect(proxima.startsWith("/") ? proxima : "/vender");
}

export async function criarConta(
  _estado: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const resultado = esquemaCadastro.safeParse({
    nome: dados.get("nome"),
    negocio: dados.get("negocio"),
    email: dados.get("email"),
    whatsapp: dados.get("whatsapp"),
    senha: dados.get("senha"),
  });
  if (!resultado.success) return { erro: primeiroErro(resultado) };

  const whatsapp = normalizarWhatsapp(resultado.data.whatsapp);
  if (!whatsapp) {
    return { erro: "Esse WhatsApp não parece válido. Confira o DDD e o número." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: resultado.data.email,
    password: resultado.data.senha,
    // O gatilho `criar_perfil_do_usuario` le estes campos para montar a conta:
    // sem `papel` no metadata, ele entende cadastro publico e cria a assinatura.
    options: {
      data: { nome: resultado.data.nome, negocio: resultado.data.negocio, whatsapp },
    },
  });

  if (error) {
    return { erro: "Não consegui criar a conta. Tente de novo em instantes." };
  }

  return {
    sucesso:
      "Conta criada. A Eucodo precisa liberar sua assinatura antes do primeiro acesso.",
  };
}

export async function enviarLinkDeSenha(
  _estado: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const resultado = esquemaEmail.safeParse({ email: dados.get("email") });
  if (!resultado.success) return { erro: primeiroErro(resultado) };

  const supabase = await createClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  await supabase.auth.resetPasswordForEmail(resultado.data.email, {
    redirectTo: `${site}/auth/callback?proxima=/redefinir-senha`,
  });

  // A resposta e sempre a mesma, com ou sem conta. Dizer "este e-mail nao
  // existe" entregaria a lista de usuarios para quem estiver testando.
  return {
    sucesso: "Se existir uma conta com esse e-mail, o link de redefinição acabou de sair.",
  };
}

export async function redefinirSenha(
  _estado: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const resultado = esquemaNovaSenha.safeParse({
    senha: dados.get("senha"),
    confirmacao: dados.get("confirmacao"),
  });
  if (!resultado.success) return { erro: primeiroErro(resultado) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { erro: "O link expirou. Peça um novo e-mail de redefinição." };
  }

  const { error } = await supabase.auth.updateUser({ password: resultado.data.senha });
  if (error) {
    return { erro: "Não consegui trocar a senha. Peça um novo link e tente de novo." };
  }

  redirect("/vender");
}

/**
 * Troca da senha provisoria, a que o admin gerou ao cadastrar o vendedor.
 *
 * So aqui o `senha_temporaria` cai. Enquanto ele estiver de pe, o layout do
 * painel devolve a pessoa para esta tela: a senha que passou pelo WhatsApp de
 * outra pessoa nao pode continuar valendo depois do primeiro acesso.
 */
export async function trocarSenhaProvisoria(
  _estado: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const resultado = esquemaNovaSenha.safeParse({
    senha: dados.get("senha"),
    confirmacao: dados.get("confirmacao"),
  });
  if (!resultado.success) return { erro: primeiroErro(resultado) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/entrar");

  const { error } = await supabase.auth.updateUser({ password: resultado.data.senha });
  if (error) {
    return { erro: "Não consegui trocar a senha. Tente de novo em instantes." };
  }

  await supabase.from("perfis").update({ senha_temporaria: false }).eq("id", user.id);

  redirect("/vender");
}

export async function sair() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}

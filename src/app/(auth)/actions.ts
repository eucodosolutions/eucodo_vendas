"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { normalizarWhatsapp } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";

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
        ? "Nao consegui falar com o servidor. Confira a configuracao do Supabase."
        : "E-mail ou senha nao conferem.",
    };
  }

  // O cadastro e aberto, o acesso nao. Conta nova espera liberacao de um admin.
  const { data: perfil } = await supabase
    .from("perfis")
    .select("status")
    .eq("id", data.user.id)
    .single();

  if (perfil?.status !== "ativo") {
    await supabase.auth.signOut();
    return {
      erro:
        perfil?.status === "bloqueado"
          ? "Este acesso foi bloqueado. Fale com o administrador."
          : "Sua conta ainda esta aguardando liberacao do administrador.",
    };
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
    email: dados.get("email"),
    whatsapp: dados.get("whatsapp"),
    senha: dados.get("senha"),
  });
  if (!resultado.success) return { erro: primeiroErro(resultado) };

  const whatsapp = normalizarWhatsapp(resultado.data.whatsapp);
  if (!whatsapp) {
    return { erro: "Esse WhatsApp nao parece valido. Confira o DDD e o numero." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: resultado.data.email,
    password: resultado.data.senha,
    options: { data: { nome: resultado.data.nome, whatsapp } },
  });

  if (error) {
    return { erro: "Nao consegui criar a conta. Tente de novo em instantes." };
  }

  return {
    sucesso:
      "Conta criada. Um administrador precisa liberar seu acesso antes do primeiro login.",
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
    sucesso: "Se existir uma conta com esse e-mail, o link de redefinicao acabou de sair.",
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
    return { erro: "O link expirou. Peca um novo e-mail de redefinicao." };
  }

  const { error } = await supabase.auth.updateUser({ password: resultado.data.senha });
  if (error) {
    return { erro: "Nao consegui trocar a senha. Peca um novo link e tente de novo." };
  }

  redirect("/vender");
}

export async function sair() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}

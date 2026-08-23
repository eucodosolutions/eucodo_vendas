import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FormularioTrocarSenha } from "./formulario";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Trocar senha" };

export default async function PaginaTrocarSenha() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/entrar");

  const { data: perfil } = await supabase
    .from("perfis")
    .select("nome, senha_temporaria")
    .eq("id", user.id)
    .single();

  // Quem ja trocou nao tem o que fazer aqui.
  if (!perfil?.senha_temporaria) redirect("/vender");

  const primeiroNome = perfil.nome.split(" ")[0];

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-tinta">
        Bem-vindo, {primeiroNome}
      </h1>
      <p className="mt-1 mb-6 text-sm text-tinta-suave">
        A senha que você recebeu é provisória. Escolha a sua para abrir o painel.
      </p>
      <FormularioTrocarSenha />
    </>
  );
}

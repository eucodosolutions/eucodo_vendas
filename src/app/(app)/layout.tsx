import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { Navegacao } from "@/components/navegacao";
import { createClient } from "@/lib/supabase/server";

export default async function LayoutPainel({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/entrar");

  const { data: perfil } = await supabase
    .from("perfis")
    .select("nome, papel, status")
    .eq("id", user.id)
    .single();

  // O proxy ja barra quem nao tem sessao. Aqui barramos quem tem sessao mas
  // ainda nao foi liberado, que e um estado possivel logo apos o cadastro.
  if (!perfil || perfil.status !== "ativo") {
    redirect("/entrar?erro=acesso_pendente");
  }

  return (
    <div className="flex min-h-full flex-col">
      <Navegacao nome={perfil.nome} ehAdmin={perfil.papel === "admin"} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-7">{children}</main>
    </div>
  );
}

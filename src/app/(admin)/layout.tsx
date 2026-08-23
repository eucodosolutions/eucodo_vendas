import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { inicioDoPapel } from "@/components/navegacao/itens";
import { Painel } from "@/components/navegacao/painel";
import { sessaoDoPainel } from "@/lib/supabase/painel";

export default async function LayoutDaPlataforma({ children }: { children: ReactNode }) {
  const sessao = await sessaoDoPainel();

  if (!sessao) redirect("/entrar");

  if (sessao.perfil.papel !== "admin") redirect(inicioDoPapel(sessao.perfil.papel));
  if (!sessao.perfil.ativo) redirect("/sair?erro=acesso_bloqueado");

  return (
    <Painel papel="admin" nome={sessao.perfil.nome} conta="Plataforma">
      {children}
    </Painel>
  );
}

import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { Painel } from "@/components/navegacao/painel";
import { motivoDoBloqueio, sessaoDoPainel } from "@/lib/supabase/painel";

export default async function LayoutDoAssinante({ children }: { children: ReactNode }) {
  const sessao = await sessaoDoPainel();

  if (!sessao) redirect("/entrar");

  // O admin opera a plataforma, nao vende. Se cair aqui, volta para o painel dele.
  if (sessao.perfil.papel === "admin") redirect("/admin");

  const bloqueio = motivoDoBloqueio(sessao);
  if (bloqueio) redirect(`/entrar?erro=${bloqueio}`);

  // Senha que o assinante gerou nao abre o painel: serve para entrar uma vez e
  // trocar. A tela de troca vive fora deste layout, senao o desvio se morderia.
  if (sessao.perfil.senha_temporaria) redirect("/trocar-senha");

  return (
    <Painel
      papel={sessao.perfil.papel}
      nome={sessao.perfil.nome}
      conta={sessao.conta?.nome ?? sessao.perfil.nome}
    >
      {children}
    </Painel>
  );
}

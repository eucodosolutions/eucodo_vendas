import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FormularioConfiguracoes } from "./formulario-configuracoes";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { sessaoDoPainel } from "@/lib/supabase/painel";
import { createClient } from "@/lib/supabase/server";
import type { Configuracoes } from "@/types/database";

export const metadata: Metadata = { title: "Ajustes" };

export default async function PaginaAjustes() {
  const sessao = await sessaoDoPainel();

  // Vendedor nao entra em Ajustes: e aqui que mora o PIX.
  if (sessao?.perfil.papel !== "assinante") redirect("/vender");

  const supabase = await createClient();

  const { data: configuracoes } = await supabase
    .from("configuracoes")
    .select("*")
    .eq("assinatura_id", sessao.perfil.assinatura_id!)
    .single<Configuracoes>();

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoDePagina
        titulo="Ajustes"
        descricao={`O pagamento da conta ${sessao.conta?.nome}.`}
      />

      {configuracoes ? <FormularioConfiguracoes configuracoes={configuracoes} /> : null}
    </div>
  );
}

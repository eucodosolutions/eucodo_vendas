import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ConexaoWhatsapp, ConexaoWhatsappCarregando } from "./conexao-whatsapp";
import { FormularioConfiguracoes } from "./formulario-configuracoes";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { sessaoDoPainel } from "@/lib/supabase/painel";
import { createClient } from "@/lib/supabase/server";
import { verConexao } from "@/lib/whatsapp/instancia";
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
        descricao={`O pagamento e o WhatsApp da conta ${sessao.conta?.nome}.`}
      />

      {/* Sem `await`: a promessa viaja para o cliente e o Suspense segura so
          esta secao. Conferir a conexao e falar com a uazapi, e um servidor
          fora do ar nao pode atrasar a chave PIX logo abaixo. */}
      <Suspense fallback={<ConexaoWhatsappCarregando />}>
        <ConexaoWhatsapp inicial={verConexao()} />
      </Suspense>

      {configuracoes ? <FormularioConfiguracoes configuracoes={configuracoes} /> : null}
    </div>
  );
}

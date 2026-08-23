import type { Metadata } from "next";

import { BotaoNovoCliente } from "./botao-novo-cliente";
import { EtiquetaDeAutor } from "@/components/etiquetas";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { CampoDeBusca } from "@/components/ui/campo-de-busca";
import { CartaoDeLista } from "@/components/ui/cartao-de-lista";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { dataHora, whatsappLegivel } from "@/lib/formato";
import { sessaoDoPainel } from "@/lib/supabase/painel";
import { createClient } from "@/lib/supabase/server";
import type { Cliente } from "@/types/database";

export const metadata: Metadata = { title: "Clientes" };

type LinhaCliente = Pick<Cliente, "id" | "nome" | "whatsapp" | "criado_em" | "criado_por"> & {
  autor: { nome: string } | null;
};

export default async function PaginaClientes({ searchParams }: PageProps<"/clientes">) {
  const { busca } = await searchParams;
  const termo = typeof busca === "string" ? busca.trim() : "";

  const supabase = await createClient();
  const sessao = await sessaoDoPainel();

  let consulta = supabase
    .from("clientes")
    // O autor vem junto porque a lista do dono da conta mistura a agenda dele
    // com a da equipe. A RLS ja limita o que cada um enxerga; o nome aqui e so
    // para a etiqueta dizer de quem e o cadastro.
    .select("id, nome, whatsapp, criado_em, criado_por, autor:perfis (nome)")
    .order("nome")
    .limit(200);

  if (termo) {
    // Virgula e parentese sao a sintaxe do filtro `or` do PostgREST: deixar
    // passar o que a pessoa digitou seria deixar ela reescrever a consulta.
    const limpo = termo.replace(/[,()*]/g, " ").trim();
    if (limpo) consulta = consulta.or(`nome.ilike.%${limpo}%,whatsapp.ilike.%${limpo}%`);
  }

  const { data } = await consulta.returns<LinhaCliente[]>();
  const clientes = data ?? [];
  const ehVendedor = sessao?.perfil.papel === "vendedor";

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoDePagina
        titulo="Clientes"
        descricao={
          ehVendedor
            ? "Os clientes que você cadastrou."
            : "Todos os clientes da sua conta, de você e da sua equipe."
        }
        acao={<BotaoNovoCliente />}
      />

      <form>
        <CampoDeBusca
          rotulo="Buscar cliente"
          placeholder="Buscar por nome ou WhatsApp"
          defaultValue={termo}
        />
      </form>

      {clientes.length === 0 ? (
        <EstadoVazio
          mensagem={
            termo
              ? "Nenhum cliente com esse nome ou número."
              : "Cadastre o primeiro cliente para começar a vender."
          }
          acao={termo ? undefined : <BotaoNovoCliente rotulo="Cadastrar o primeiro" />}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {clientes.map((cliente) => (
            <li key={cliente.id}>
              <CartaoDeLista href={`/clientes/${cliente.id}`}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-base font-medium text-tinta">{cliente.nome}</p>
                    {/* So aparece no cadastro que nao e de quem esta olhando. O
                        vendedor ve apenas os proprios clientes, entao para ele
                        a etiqueta nunca acende. */}
                    {cliente.criado_por && cliente.criado_por !== sessao?.perfil.id ? (
                      <EtiquetaDeAutor nome={cliente.autor?.nome ?? "alguém da equipe"} />
                    ) : null}
                  </div>
                  <p className="text-sm text-tinta-suave tabular-nums">
                    {whatsappLegivel(cliente.whatsapp)}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-tinta-suave tabular-nums">
                  {dataHora(cliente.criado_em)}
                </span>
              </CartaoDeLista>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

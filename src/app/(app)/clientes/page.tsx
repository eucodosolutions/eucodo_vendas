import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { LinkBotao } from "@/components/ui/link-botao";
import { dataHora, whatsappLegivel } from "@/lib/formato";
import { sessaoDoPainel } from "@/lib/supabase/painel";
import { createClient } from "@/lib/supabase/server";
import type { Cliente } from "@/types/database";

export const metadata: Metadata = { title: "Clientes" };

type LinhaCliente = Pick<Cliente, "id" | "nome" | "whatsapp" | "criado_em">;

export default async function PaginaClientes({ searchParams }: PageProps<"/clientes">) {
  const { busca } = await searchParams;
  const termo = typeof busca === "string" ? busca.trim() : "";

  const supabase = await createClient();
  const sessao = await sessaoDoPainel();

  let consulta = supabase
    .from("clientes")
    .select("id, nome, whatsapp, criado_em")
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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-tinta">Clientes</h1>
          <p className="mt-1 text-sm text-tinta-suave">
            {ehVendedor
              ? "Os clientes que você cadastrou."
              : "Todos os clientes da sua conta, de você e da sua equipe."}
          </p>
        </div>
        <LinkBotao href="/clientes/novo">Novo cliente</LinkBotao>
      </header>

      <form className="relative">
        <Search
          size={16}
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-tinta-suave"
        />
        <input
          type="search"
          name="busca"
          defaultValue={termo}
          placeholder="Buscar por nome ou WhatsApp"
          aria-label="Buscar cliente"
          className="h-10 w-full rounded-lg border border-borda bg-superficie pr-3 pl-9 text-sm text-tinta transition-colors hover:border-borda-forte placeholder:text-tinta-suave/70"
        />
      </form>

      {clientes.length === 0 ? (
        <div className="rounded-card border border-dashed border-borda-forte bg-superficie p-10 text-center">
          <p className="text-sm text-tinta-suave">
            {termo
              ? "Nenhum cliente com esse nome ou número."
              : "Cadastre o primeiro cliente para começar a vender."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {clientes.map((cliente) => (
            <li key={cliente.id}>
              <Link
                href={`/clientes/${cliente.id}`}
                className="flex items-center justify-between gap-3 rounded-card border border-borda bg-superficie px-4 py-3 transition-colors hover:border-borda-forte"
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-medium text-tinta">{cliente.nome}</p>
                  <p className="text-sm text-tinta-suave tabular-nums">
                    {whatsappLegivel(cliente.whatsapp)}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-tinta-suave tabular-nums">
                  {dataHora(cliente.criado_em)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

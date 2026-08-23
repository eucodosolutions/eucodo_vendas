import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DadosDoCliente } from "./dados-do-cliente";
import { EtiquetaDeAutor, EtiquetaPagamento, EtiquetaStatus } from "@/components/etiquetas";
import { LinkBotao } from "@/components/ui/link-botao";
import { Secao } from "@/components/ui/secao";
import { dataHora, moeda, whatsappLegivel } from "@/lib/formato";
import { sessaoDoPainel } from "@/lib/supabase/painel";
import { createClient } from "@/lib/supabase/server";
import type { Cliente, Pedido } from "@/types/database";

export const metadata: Metadata = { title: "Cliente" };

type ClienteComAutor = Cliente & { autor: { nome: string } | null };

type LinhaPedido = Pick<
  Pedido,
  "id" | "codigo" | "total_centavos" | "status" | "pagamento" | "criado_em"
>;

export default async function PaginaCliente({ params }: PageProps<"/clientes/[id]">) {
  const { id } = await params;

  const supabase = await createClient();
  const sessao = await sessaoDoPainel();

  const { data: cliente } = await supabase
    .from("clientes")
    .select("*, autor:perfis (nome)")
    .eq("id", id)
    .single<ClienteComAutor>();

  if (!cliente) notFound();

  const { data: pedidos } = await supabase
    .from("pedidos")
    .select("id, codigo, total_centavos, status, pagamento, criado_em")
    .eq("cliente_id", id)
    .order("criado_em", { ascending: false })
    .limit(50)
    .returns<LinhaPedido[]>();

  // Quem cadastrou manda no cadastro, e o dono da conta manda em todos. E a
  // mesma regra da policy: repetida aqui so para a tela nao oferecer um botao
  // que o banco vai recusar.
  const daPessoa = Boolean(sessao && cliente.criado_por === sessao.perfil.id);
  const podeEditar = sessao?.perfil.papel === "assinante" || daPessoa;
  const compras = pedidos ?? [];
  const gasto = compras
    .filter((pedido) => pedido.status !== "cancelado")
    .reduce((soma, pedido) => soma + pedido.total_centavos, 0);

  return (
    <div className="flex flex-col gap-5">
      <Link href="/clientes" className="text-sm font-medium text-marca hover:underline">
        Voltar para os clientes
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-tinta">
              {cliente.nome}
            </h1>
            {cliente.criado_por && !daPessoa ? (
              <EtiquetaDeAutor nome={cliente.autor?.nome ?? "alguém da equipe"} />
            ) : null}
          </div>
          <p className="mt-1 text-sm text-tinta-suave tabular-nums">
            {whatsappLegivel(cliente.whatsapp)}
          </p>
        </div>
        <LinkBotao href="/vender">Vender para este cliente</LinkBotao>
      </header>

      <DadosDoCliente cliente={cliente} podeEditar={podeEditar} />

      <Secao titulo="Pedidos deste cliente">
        {compras.length === 0 ? (
          <p className="text-sm text-tinta-suave">Nenhum pedido para este cliente ainda.</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-tinta-suave">
              {compras.length} pedido{compras.length > 1 ? "s" : ""}, {moeda(gasto)} no total.
            </p>
            <ul className="flex flex-col gap-2">
              {compras.map((pedido) => (
                <li key={pedido.id}>
                  <Link
                    href={`/pedidos/${pedido.id}`}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-borda px-3 py-2.5 transition-colors hover:border-borda-forte"
                  >
                    <span className="font-mono text-xs font-medium text-tinta-suave">
                      {pedido.codigo}
                    </span>
                    <EtiquetaStatus status={pedido.status} />
                    <EtiquetaPagamento pagamento={pedido.pagamento} />
                    <span className="ml-auto text-sm font-medium text-tinta tabular-nums">
                      {moeda(pedido.total_centavos)}
                    </span>
                    <span className="text-xs text-tinta-suave tabular-nums">
                      {dataHora(pedido.criado_em)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Secao>
    </div>
  );
}

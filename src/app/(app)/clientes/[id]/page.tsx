import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RemoverCliente } from "./remover-cliente";
import { FormularioCliente } from "../formulario-cliente";
import { EtiquetaPagamento, EtiquetaStatus } from "@/components/etiquetas";
import { LinkBotao } from "@/components/ui/link-botao";
import { Dado, Secao } from "@/components/ui/secao";
import { dataHora, moeda, whatsappLegivel } from "@/lib/formato";
import { sessaoDoPainel } from "@/lib/supabase/painel";
import { createClient } from "@/lib/supabase/server";
import type { Cliente, Pedido } from "@/types/database";

export const metadata: Metadata = { title: "Cliente" };

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
    .select("*")
    .eq("id", id)
    .single<Cliente>();

  if (!cliente) notFound();

  const { data: pedidos } = await supabase
    .from("pedidos")
    .select("id, codigo, total_centavos, status, pagamento, criado_em")
    .eq("cliente_id", id)
    .order("criado_em", { ascending: false })
    .limit(50)
    .returns<LinhaPedido[]>();

  const podeEditar = sessao?.perfil.papel === "assinante";
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
          <h1 className="truncate text-2xl font-semibold tracking-tight text-tinta">
            {cliente.nome}
          </h1>
          <p className="mt-1 text-sm text-tinta-suave tabular-nums">
            {whatsappLegivel(cliente.whatsapp)}
          </p>
        </div>
        <LinkBotao href="/vender">Vender para este cliente</LinkBotao>
      </header>

      {podeEditar ? (
        <FormularioCliente cliente={cliente} />
      ) : (
        // O vendedor ve o cadastro e nao edita: a policy de update e do dono da
        // conta, entao mostrar o formulario so entregaria um erro no envio.
        <Secao titulo="Dados do cliente">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Dado rotulo="Nome" valor={cliente.nome} />
            <Dado rotulo="WhatsApp" valor={whatsappLegivel(cliente.whatsapp)} />
            <Dado
              rotulo="Link de avaliação"
              valor={
                cliente.link_avaliacao ? (
                  <a
                    href={cliente.link_avaliacao}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="break-all text-marca hover:underline"
                  >
                    {cliente.link_avaliacao}
                  </a>
                ) : (
                  "Não cadastrado"
                )
              }
            />
            <Dado rotulo="Observações" valor={cliente.observacoes ?? "Nenhuma"} />
          </dl>
          <p className="mt-4 text-xs text-tinta-suave">
            Alterar ou remover cliente é com o dono da conta.
          </p>
        </Secao>
      )}

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

      {podeEditar ? (
        <div className="flex justify-end">
          <RemoverCliente id={cliente.id} nome={cliente.nome} />
        </div>
      ) : null}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { EtiquetaPagamento, EtiquetaStatus } from "@/components/etiquetas";
import { LinkBotao } from "@/components/ui/link-botao";
import { dataHora, moeda, whatsappLegivel } from "@/lib/formato";
import { sessaoDoPainel } from "@/lib/supabase/painel";
import { createClient } from "@/lib/supabase/server";
import type { Cliente, Pedido, PedidoItem } from "@/types/database";

export const metadata: Metadata = { title: "Pedidos" };

type LinhaPedido = Pick<
  Pedido,
  | "id"
  | "codigo"
  | "total_centavos"
  | "status"
  | "pagamento"
  | "comissao_centavos"
  | "comissao_paga_em"
  | "criado_em"
> & {
  clientes: Pick<Cliente, "nome" | "whatsapp"> | null;
  pedido_itens: Array<Pick<PedidoItem, "nome_negocio" | "produto_nome" | "quantidade">>;
};

export default async function PaginaPedidos() {
  const supabase = await createClient();
  const sessao = await sessaoDoPainel();

  // A RLS ja entrega ao vendedor so os pedidos dele. O papel serve para trocar a
  // conta do cabecalho: o dono quer saber quanto a casa tem a receber, o
  // vendedor quer saber quanto ele tem a receber.
  const ehVendedor = sessao?.perfil.papel === "vendedor";

  const { data } = await supabase
    .from("pedidos")
    .select(
      "id, codigo, total_centavos, status, pagamento, comissao_centavos, comissao_paga_em, criado_em, clientes (nome, whatsapp), pedido_itens (nome_negocio, produto_nome, quantidade)",
    )
    .order("criado_em", { ascending: false })
    .limit(100)
    .returns<LinhaPedido[]>();

  const pedidos = data ?? [];
  const vivos = pedidos.filter((pedido) => pedido.status !== "cancelado");

  const aReceber = ehVendedor
    ? vivos
        .filter((pedido) => pedido.pagamento === "pago" && !pedido.comissao_paga_em)
        .reduce((soma, pedido) => soma + pedido.comissao_centavos, 0)
    : vivos
        .filter((pedido) => pedido.pagamento === "pendente")
        .reduce((soma, pedido) => soma + pedido.total_centavos, 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-tinta">Pedidos</h1>
          <p className="mt-1 text-sm text-tinta-suave">
            {pedidos.length === 0
              ? "Nenhum pedido ainda."
              : `${pedidos.length} pedido${pedidos.length > 1 ? "s" : ""}, ${moeda(aReceber)} ${ehVendedor ? "de comissão " : ""}a receber.`}
          </p>
        </div>
        <LinkBotao href="/vender">Novo pedido</LinkBotao>
      </header>

      {pedidos.length === 0 ? (
        <div className="rounded-card border border-dashed border-borda-forte bg-superficie p-10 text-center">
          <p className="text-sm text-tinta-suave">
            Os pedidos aparecem aqui assim que a primeira venda for fechada.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {pedidos.map((pedido) => (
            <li key={pedido.id}>
              <Link
                href={`/pedidos/${pedido.id}`}
                className="flex flex-col gap-3 rounded-card border border-borda bg-superficie p-4 transition-colors hover:border-borda-forte sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-medium text-tinta-suave">
                      {pedido.codigo}
                    </span>
                    <EtiquetaStatus status={pedido.status} />
                    <EtiquetaPagamento pagamento={pedido.pagamento} />
                  </div>

                  <p className="mt-1 truncate text-base font-medium text-tinta">
                    {pedido.clientes?.nome ?? "Cliente removido"}
                  </p>

                  <p className="text-sm text-tinta-suave">
                    {resumirItens(pedido.pedido_itens)}
                    {pedido.clientes ? ` | ${whatsappLegivel(pedido.clientes.whatsapp)}` : ""}
                  </p>
                </div>

                <div className="shrink-0 text-left sm:text-right">
                  <p className="text-lg font-semibold text-tinta tabular-nums">
                    {moeda(pedido.total_centavos)}
                  </p>
                  {ehVendedor && pedido.comissao_centavos > 0 ? (
                    <p className="text-xs font-medium text-sucesso tabular-nums">
                      {moeda(pedido.comissao_centavos)} de comissão
                      {pedido.comissao_paga_em ? ", já acertada" : ""}
                    </p>
                  ) : null}
                  <p className="text-xs text-tinta-suave tabular-nums">
                    {dataHora(pedido.criado_em)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Uma linha para o pedido inteiro.
 *
 * Com um item so, o que interessa e de qual negocio e a placa — e, quando nao e
 * placa, o nome do produto. Com varios, a lista nao caberia e vale a contagem.
 */
function resumirItens(
  itens: Array<Pick<PedidoItem, "nome_negocio" | "produto_nome" | "quantidade">>,
): string {
  if (itens.length === 0) return "Sem itens";

  const pecas = itens.reduce((soma, item) => soma + item.quantidade, 0);

  if (itens.length === 1) {
    const item = itens[0];
    const nome = item.nome_negocio || item.produto_nome;
    return item.quantidade > 1 ? `${nome}, ${item.quantidade} unidades` : nome;
  }

  return `${itens.length} itens, ${pecas} peças`;
}

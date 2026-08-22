import type { Metadata } from "next";
import Link from "next/link";

import { EtiquetaPagamento, EtiquetaStatus } from "@/components/etiquetas";
import { LinkBotao } from "@/components/ui/link-botao";
import { dataHora, moeda, ROTULO_COR, whatsappLegivel } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import type { Pedido } from "@/types/database";

export const metadata: Metadata = { title: "Pedidos" };

type LinhaPedido = Pick<
  Pedido,
  | "id"
  | "codigo"
  | "nome_negocio"
  | "whatsapp"
  | "tamanho_codigo"
  | "cor"
  | "tecnologia"
  | "quantidade"
  | "total_centavos"
  | "status"
  | "pagamento"
  | "criado_em"
>;

export default async function PaginaPedidos() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("pedidos")
    .select(
      "id, codigo, nome_negocio, whatsapp, tamanho_codigo, cor, tecnologia, quantidade, total_centavos, status, pagamento, criado_em",
    )
    .order("criado_em", { ascending: false })
    .limit(100)
    .returns<LinhaPedido[]>();

  const pedidos = data ?? [];

  const aReceber = pedidos
    .filter((pedido) => pedido.pagamento === "pendente" && pedido.status !== "cancelado")
    .reduce((soma, pedido) => soma + pedido.total_centavos, 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-tinta">Pedidos</h1>
          <p className="mt-1 text-sm text-tinta-suave">
            {pedidos.length === 0
              ? "Nenhum pedido ainda."
              : `${pedidos.length} pedido${pedidos.length > 1 ? "s" : ""}, ${moeda(aReceber)} a receber.`}
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
                    {pedido.nome_negocio}
                  </p>
                  <p className="text-sm text-tinta-suave">
                    {pedido.tamanho_codigo} {ROTULO_COR[pedido.cor].toLowerCase()},{" "}
                    {pedido.tecnologia === "qr_nfc" ? "com NFC" : "so QR"}
                    {pedido.quantidade > 1 ? `, ${pedido.quantidade} unidades` : ""}
                    {" | "}
                    {whatsappLegivel(pedido.whatsapp)}
                  </p>
                </div>
                <div className="shrink-0 text-left sm:text-right">
                  <p className="text-lg font-semibold text-tinta tabular-nums">
                    {moeda(pedido.total_centavos)}
                  </p>
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

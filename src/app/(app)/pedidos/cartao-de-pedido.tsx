"use client";

import Link from "next/link";
import type { DragEvent, ReactNode } from "react";

import { resumirItens, type LinhaPedido } from "./linha";
import { EtiquetaPagamento, EtiquetaStatus } from "@/components/etiquetas";
import { juntar } from "@/components/ui/controle";
import { data, dataHora, moeda, whatsappLegivel } from "@/lib/formato";

/**
 * O pedido como cartao, na lista e na coluna do quadro.
 *
 * Sao duas larguras muito diferentes para a mesma informacao: a linha da lista
 * tem a tela inteira e pode espalhar cliente, itens e valor lado a lado; a
 * coluna do quadro tem um quinto disso e precisa empilhar. Em vez de dois
 * componentes que envelheceriam separados, um so com a variante `compacto` — o
 * que muda e o arranjo, nao o que se le.
 *
 * No quadro a etiqueta de status nao aparece: a coluna ja e o status, e repetir
 * gasta a linha que o nome do cliente precisa.
 *
 * A `acao` fica fora do `<Link>`, e nao dentro: botao dentro de link nao e HTML
 * valido, e o clique no botao viraria navegacao para o detalhe.
 */
export function CartaoDePedido({
  pedido,
  ehVendedor,
  compacto,
  acao,
  arrastavel,
  arrastando,
  aoComecarArrasto,
  aoTerminarArrasto,
}: {
  pedido: LinhaPedido;
  /** O vendedor ve a comissao dele; o dono da conta ve o valor da venda. */
  ehVendedor: boolean;
  compacto?: boolean;
  acao?: ReactNode;
  arrastavel?: boolean;
  arrastando?: boolean;
  aoComecarArrasto?: (evento: DragEvent<HTMLDivElement>) => void;
  aoTerminarArrasto?: () => void;
}) {
  return (
    <div
      draggable={arrastavel}
      onDragStart={aoComecarArrasto}
      onDragEnd={aoTerminarArrasto}
      className={juntar(
        "flex flex-col rounded-card border border-borda bg-superficie transition-colors",
        arrastavel && "cursor-grab active:cursor-grabbing",
        arrastando ? "opacity-40" : "hover:border-borda-forte",
      )}
    >
      {/* `draggable={false}` no link porque o navegador ja arrasta link sozinho,
          carregando a URL. Desligando o dele, o gesto sobe para o cartao. */}
      <Link
        href={`/pedidos/${pedido.id}`}
        draggable={false}
        className={juntar(
          "flex min-w-0 flex-col gap-2 p-4",
          !compacto && "sm:flex-row sm:items-center sm:justify-between sm:gap-3",
        )}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-medium text-tinta-suave">{pedido.codigo}</span>
            {compacto ? null : <EtiquetaStatus status={pedido.status} />}
            <EtiquetaPagamento pagamento={pedido.pagamento} />
          </div>

          <p className="mt-1 truncate text-base font-medium text-tinta">
            {pedido.clientes?.nome ?? "Cliente removido"}
          </p>

          <p className="truncate text-sm text-tinta-suave">
            {resumirItens(pedido.pedido_itens)}
            {!compacto && pedido.clientes ? ` | ${whatsappLegivel(pedido.clientes.whatsapp)}` : ""}
          </p>
        </div>

        {/* Na coluna o valor e a data dividem uma linha so, porque a largura e a
            de um quinto de tela; na lista o bloco vai para a direita inteiro. */}
        <div className={juntar("shrink-0", compacto ? null : "text-left sm:text-right")}>
          <div
            className={juntar(compacto && "flex items-baseline justify-between gap-2")}
          >
            <p
              className={juntar(
                "font-semibold text-tinta tabular-nums",
                compacto ? "text-base" : "text-lg",
              )}
            >
              {moeda(pedido.total_centavos)}
            </p>
            <p className="text-xs text-tinta-suave tabular-nums">
              {compacto ? data(pedido.criado_em) : dataHora(pedido.criado_em)}
            </p>
          </div>

          {ehVendedor && pedido.comissao_centavos > 0 ? (
            <p className="text-xs font-medium text-sucesso tabular-nums">
              {moeda(pedido.comissao_centavos)} de comissão
              {pedido.comissao_paga_em ? ", já acertada" : ""}
            </p>
          ) : null}
        </div>
      </Link>

      {acao ? <div className="border-t border-borda px-3 py-2">{acao}</div> : null}
    </div>
  );
}

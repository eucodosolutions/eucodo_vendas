"use client";

import { useActionState, useState } from "react";

import {
  cancelarPedido,
  marcarPago,
  mudarStatus,
  regerarArte,
  reenviarMensagem,
  type EstadoAcao,
} from "./acoes";
import { Alerta } from "@/components/ui/alerta";
import { Botao } from "@/components/ui/botao";
import { ROTULO_PAGAMENTO, ROTULO_STATUS } from "@/lib/formato";
import type { FormaPagamento, StatusPagamento, StatusPedido } from "@/types/database";

const PROXIMO_STATUS: Record<StatusPedido, StatusPedido[]> = {
  novo: ["em_producao"],
  em_producao: ["pronto"],
  pronto: ["entregue"],
  entregue: [],
  cancelado: [],
};

const FORMAS: FormaPagamento[] = [
  "pix",
  "dinheiro",
  "cartao_credito",
  "cartao_debito",
  "transferencia",
];

export function AcoesDoPedido({
  pedidoId,
  status,
  pagamento,
  temArte,
}: {
  pedidoId: string;
  status: StatusPedido;
  pagamento: StatusPagamento;
  temArte: boolean;
}) {
  const [estadoStatus, acaoStatus] = useActionState<EstadoAcao, FormData>(mudarStatus, {});
  const [estadoPagamento, acaoPagamento] = useActionState<EstadoAcao, FormData>(marcarPago, {});
  const [estadoCancelar, acaoCancelar] = useActionState<EstadoAcao, FormData>(cancelarPedido, {});
  const [estadoArte, acaoArte] = useActionState<EstadoAcao, FormData>(regerarArte, {});
  const [estadoEnvio, acaoEnvio] = useActionState<EstadoAcao, FormData>(reenviarMensagem, {});

  const [mostrarCancelamento, setMostrarCancelamento] = useState(false);
  const [forma, setForma] = useState<FormaPagamento>("pix");

  const cancelado = status === "cancelado";
  const proximos = PROXIMO_STATUS[status];
  const estados = [estadoStatus, estadoPagamento, estadoCancelar, estadoArte, estadoEnvio];
  const mensagem =
    estados.find((estado) => estado.erro)?.erro ?? estados.find((estado) => estado.sucesso)?.sucesso;
  const ehErro = estados.some((estado) => estado.erro);
  const linkManual = estados.find((estado) => estado.link)?.link;

  return (
    <section className="flex flex-col gap-4 rounded-card border border-borda bg-superficie p-5">
      <h2 className="text-sm font-semibold tracking-wide text-tinta-suave uppercase">Acoes</h2>

      {mensagem ? <Alerta tom={ehErro ? "erro" : "sucesso"}>{mensagem}</Alerta> : null}

      {/* Sem instancia conectada, a mensagem sai daqui, aberta pelo vendedor. */}
      {linkManual ? (
        <a
          href={linkManual}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex h-12 items-center justify-center gap-2 self-start rounded-lg bg-sucesso px-5 text-base font-medium text-white transition-opacity hover:opacity-90"
        >
          Abrir WhatsApp com a mensagem pronta
        </a>
      ) : null}

      {cancelado ? (
        <p className="text-sm text-tinta-suave">
          Este pedido esta cancelado. Nao da para mudar status nem baixar pagamento.
        </p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {proximos.map((proximo) => (
            <form key={proximo} action={acaoStatus}>
              <input type="hidden" name="pedidoId" value={pedidoId} />
              <input type="hidden" name="status" value={proximo} />
              <Botao type="submit" carregandoTexto="Salvando...">
                Marcar como {ROTULO_STATUS[proximo].toLowerCase()}
              </Botao>
            </form>
          ))}

          {pagamento === "pendente" ? (
            <form action={acaoPagamento} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="pedidoId" value={pedidoId} />
              <select
                name="forma"
                value={forma}
                onChange={(evento) => setForma(evento.target.value as FormaPagamento)}
                aria-label="Forma de pagamento"
                className="h-12 rounded-lg border border-borda bg-superficie px-3 text-base text-tinta"
              >
                {FORMAS.map((valor) => (
                  <option key={valor} value={valor}>
                    {ROTULO_PAGAMENTO[valor]}
                  </option>
                ))}
              </select>
              <Botao type="submit" variante="secundario" carregandoTexto="Salvando...">
                Marcar como pago
              </Botao>
            </form>
          ) : null}

          <form action={acaoEnvio}>
            <input type="hidden" name="pedidoId" value={pedidoId} />
            <Botao type="submit" variante="secundario" carregandoTexto="Enviando...">
              Mandar a arte no WhatsApp
            </Botao>
          </form>

          <form action={acaoArte}>
            <input type="hidden" name="pedidoId" value={pedidoId} />
            <Botao type="submit" variante="secundario" carregandoTexto="Gerando...">
              {temArte ? "Gerar a arte de novo" : "Gerar a arte"}
            </Botao>
          </form>
        </div>
      )}

      {!cancelado ? (
        mostrarCancelamento ? (
          <form action={acaoCancelar} className="flex flex-col gap-3 border-t border-borda pt-4">
            <input type="hidden" name="pedidoId" value={pedidoId} />
            <label htmlFor="motivo" className="text-sm font-medium text-tinta">
              Por que este pedido esta sendo cancelado?
            </label>
            <input
              id="motivo"
              name="motivo"
              required
              minLength={3}
              placeholder="Cliente desistiu, dado errado, pagamento nao veio"
              className="h-12 rounded-lg border border-borda bg-superficie px-3.5 text-base text-tinta"
            />
            <div className="flex flex-wrap gap-3">
              <Botao type="submit" variante="secundario" carregandoTexto="Cancelando...">
                Confirmar cancelamento
              </Botao>
              <button
                type="button"
                onClick={() => setMostrarCancelamento(false)}
                className="h-12 rounded-lg px-4 text-sm font-medium text-tinta-media hover:bg-papel"
              >
                Deixar como esta
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setMostrarCancelamento(true)}
            className="self-start text-sm font-medium text-erro hover:underline"
          >
            Cancelar pedido
          </button>
        )
      ) : null}
    </section>
  );
}

"use client";

import { useActionState, useState } from "react";

import {
  cancelarPedido,
  marcarPago,
  mudarStatus,
  reenviarMensagem,
  regerarArte,
  type EstadoAcao,
} from "./acoes";
import { useAviso } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { Secao } from "@/components/ui/secao";
import { Selecao } from "@/components/ui/selecao";
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

  // Cada acao avisa por conta propria. O toast que traz o link do WhatsApp
  // carrega o botao de abrir a conversa, entao nada precisa ficar na tela.
  useAviso(estadoStatus);
  useAviso(estadoPagamento);
  useAviso(estadoCancelar);
  useAviso(estadoArte);
  useAviso(estadoEnvio);

  const [mostrarCancelamento, setMostrarCancelamento] = useState(false);
  const cancelado = status === "cancelado";

  if (cancelado) {
    return (
      <Secao titulo="Ações">
        <p className="text-sm text-tinta-suave">
          Este pedido está cancelado. Não dá para mudar status nem baixar pagamento.
        </p>
      </Secao>
    );
  }

  return (
    <Secao titulo="Ações">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          {PROXIMO_STATUS[status].map((proximo) => (
            <form key={proximo} action={acaoStatus}>
              <input type="hidden" name="pedidoId" value={pedidoId} />
              <input type="hidden" name="status" value={proximo} />
              <Botao type="submit" carregandoTexto="Salvando...">
                Marcar como {ROTULO_STATUS[proximo].toLowerCase()}
              </Botao>
            </form>
          ))}

          {pagamento === "pendente" ? (
            <form action={acaoPagamento} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="pedidoId" value={pedidoId} />
              <div className="w-44">
                <Selecao
                  rotulo="Forma de pagamento"
                  rotuloOculto
                  name="forma"
                  defaultValue="pix"
                  opcoes={FORMAS.map((valor) => ({
                    valor,
                    texto: ROTULO_PAGAMENTO[valor],
                  }))}
                />
              </div>
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

        {mostrarCancelamento ? (
          <form action={acaoCancelar} className="flex flex-col gap-3 border-t border-borda pt-4">
            <input type="hidden" name="pedidoId" value={pedidoId} />
            <Campo
              rotulo="Por que este pedido está sendo cancelado?"
              name="motivo"
              required
              minLength={3}
              placeholder="Cliente desistiu, dado errado, pagamento não veio"
            />
            <div className="flex flex-wrap gap-3">
              <Botao type="submit" variante="secundario" carregandoTexto="Cancelando...">
                Confirmar cancelamento
              </Botao>
              <Botao type="button" variante="fantasma" onClick={() => setMostrarCancelamento(false)}>
                Deixar como está
              </Botao>
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
        )}
      </div>
    </Secao>
  );
}

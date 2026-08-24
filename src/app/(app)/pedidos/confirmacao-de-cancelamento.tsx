"use client";

import { useActionState, useState } from "react";

import { cancelarPedido, type EstadoAcao } from "./[id]/acoes";
import { Campo } from "@/components/ui/campo";
import { Confirmacao } from "@/components/ui/confirmacao";
import { Interruptor } from "@/components/ui/interruptor";

/**
 * A janela de cancelar pedido, com motivo obrigatorio.
 *
 * Saiu da tela de detalhe para ca quando o quadro passou a aceitar arrastar um
 * cartao para a coluna Cancelado. Cancelar nao e uma mudanca de status como as
 * outras: o banco exige a data (`cancelado_precisa_de_data`) e o motivo fica no
 * historico, entao `mudarStatus` nem aceita `cancelado` como destino. Copiar o
 * bloco para o quadro deixaria dois formularios para a mesma decisao, e o dia
 * em que um ganhasse um campo novo o outro ficaria para tras.
 *
 * Quem chama monta e desmonta o componente em vez de so fechar: o estado da
 * action e o do interruptor moram aqui dentro, e reaproveitar a instancia faria
 * o proximo cancelamento abrir com o resto do anterior.
 */
export function ConfirmacaoDeCancelamento({
  pedidoId,
  aoFechar,
}: {
  pedidoId: string;
  aoFechar: () => void;
}) {
  const [estado, acao, pendente] = useActionState<EstadoAcao, FormData>(cancelarPedido, {});
  const [avisarCliente, setAvisarCliente] = useState(true);

  return (
    <Confirmacao
      aberto
      aoFechar={aoFechar}
      titulo="Cancelar este pedido?"
      mensagem="O pedido para de andar: não dá mais para mudar status nem baixar pagamento. O motivo fica no histórico."
      acao={acao}
      estado={estado}
      pendente={pendente}
      confirmarRotulo="Confirmar cancelamento"
      carregandoTexto="Cancelando..."
      ocultos={{ pedidoId, avisar: avisarCliente ? "sim" : "nao" }}
    >
      <Campo
        rotulo="Por que este pedido está sendo cancelado?"
        name="motivo"
        required
        minLength={3}
        placeholder="Cliente desistiu, dado errado, pagamento não veio"
      />

      {/* O motivo e sempre obrigatorio porque fica no historico; o aviso e
          escolha do vendedor. Cancelamento combinado na conversa nao precisa
          de mensagem, e pedido que o cliente nem sabe que existia menos
          ainda. */}
      <div className="flex items-center justify-between gap-4 rounded-lg border border-borda bg-papel p-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-tinta">Avisar o cliente no WhatsApp</p>
          <p className="mt-0.5 text-sm text-tinta-suave">
            {avisarCliente
              ? "Ele recebe a mensagem de pedido cancelado. O motivo não vai junto."
              : "O pedido é cancelado calado, sem mensagem nenhuma."}
          </p>
        </div>
        <Interruptor
          ligado={avisarCliente}
          rotulo="Avisar o cliente no WhatsApp"
          onChange={setAvisarCliente}
        />
      </div>
    </Confirmacao>
  );
}

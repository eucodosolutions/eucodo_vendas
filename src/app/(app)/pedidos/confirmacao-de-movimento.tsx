"use client";

import { useActionState, useState } from "react";

import { mudarStatus, type EstadoAcao } from "./[id]/acoes";
import { Confirmacao } from "@/components/ui/confirmacao";
import { Interruptor } from "@/components/ui/interruptor";
import { ROTULO_STATUS } from "@/lib/formato";
import { ehVoltar, temMensagemParaOCliente } from "@/lib/pedidos/fluxo";
import type { StatusPedido } from "@/types/database";

/**
 * "Marcar como pronto?", antes de mexer no pedido.
 *
 * Existe porque mudar status manda WhatsApp para o cliente, e mensagem enviada
 * nao volta. Um botao escrito "marcar como pronto" ja diz o que vai acontecer;
 * um cartao que escorregou da mao para a coluna errada nao diz nada. A pergunta
 * e a diferenca entre um arrasto torto e uma mensagem errada no telefone de um
 * cliente de verdade.
 *
 * O interruptor comeca ligado ao avancar e desligado ao voltar: ir para tras e
 * conserto de engano, e quem acabou de receber "seu pedido esta pronto" nao
 * pode receber "seu pedido esta em producao" logo depois.
 */
export function ConfirmacaoDeMovimento({
  pedidoId,
  codigo,
  de,
  para,
  aoFechar,
}: {
  pedidoId: string;
  codigo: string;
  de: StatusPedido;
  para: StatusPedido;
  aoFechar: () => void;
}) {
  const [estado, acao, pendente] = useActionState<EstadoAcao, FormData>(mudarStatus, {});
  const voltando = ehVoltar(de, para);
  // Voltar para "novo" nao tem mensagem nenhuma para mandar, entao nem o
  // interruptor aparece: controle que nao muda nada e so mais uma coisa para ler.
  const podeAvisar = temMensagemParaOCliente(para);
  const [avisarCliente, setAvisarCliente] = useState(!voltando);
  const avisando = podeAvisar && avisarCliente;

  return (
    <Confirmacao
      aberto
      aoFechar={aoFechar}
      titulo={`Marcar ${codigo} como ${ROTULO_STATUS[para].toLowerCase()}?`}
      mensagem={
        voltando
          ? `O pedido volta de ${ROTULO_STATUS[de].toLowerCase()} para ${ROTULO_STATUS[para].toLowerCase()}. A mudança fica no histórico.`
          : `O pedido sai de ${ROTULO_STATUS[de].toLowerCase()} e vai para ${ROTULO_STATUS[para].toLowerCase()}.`
      }
      acao={acao}
      estado={estado}
      pendente={pendente}
      confirmarRotulo={`Marcar como ${ROTULO_STATUS[para].toLowerCase()}`}
      carregandoTexto="Salvando..."
      ocultos={{ pedidoId, status: para, avisar: avisando ? "sim" : "nao" }}
    >
      {podeAvisar ? (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-borda bg-papel p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-tinta">Avisar o cliente no WhatsApp</p>
            <p className="mt-0.5 text-sm text-tinta-suave">
              {avisarCliente
                ? `Ele recebe a mensagem de pedido ${ROTULO_STATUS[para].toLowerCase()}.`
                : "O pedido anda calado, sem mensagem nenhuma."}
            </p>
          </div>
          <Interruptor
            ligado={avisarCliente}
            rotulo="Avisar o cliente no WhatsApp"
            onChange={setAvisarCliente}
          />
        </div>
      ) : null}
    </Confirmacao>
  );
}

"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";

import { ListaDoCarrinho } from "./carrinho";
import { EscolherCliente, type ClienteDaLista } from "./escolher-cliente";
import { avisar } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { Escolha } from "@/components/ui/escolha";
import { Modal } from "@/components/ui/modal";
import { totalDoCarrinho, type ItemDoCarrinho } from "@/lib/carrinho/carrinho";
import { moeda } from "@/lib/formato";
import type { FormaCombinada, MomentoPagamento } from "@/types/database";

/**
 * O fecho do pedido: para quem e, como paga, e quando paga.
 *
 * As duas perguntas de pagamento sao separadas de proposito. "PIX" diz por onde
 * o dinheiro entra; "pagar agora" diz se a cobranca sai junto da mensagem. So a
 * combinacao das duas — PIX e agora — manda o copia e cola no WhatsApp; o resto
 * fecha o pedido e deixa o acerto para a conversa.
 *
 * Combinar nao e receber: em nenhum caso o pedido nasce pago. A baixa continua
 * sendo o "Marcar como pago" da tela do pedido, no dia em que o dinheiro cair.
 */
export function ModalFechamento({
  aberto,
  aoFechar,
  itens,
  clientes,
  pixConfigurado,
  aoConfirmar,
  fechando,
}: {
  aberto: boolean;
  aoFechar: () => void;
  itens: ItemDoCarrinho[];
  clientes: ClienteDaLista[];
  /** A conta tem chave PIX em Ajustes. Sem ela nao ha copia e cola para mandar. */
  pixConfigurado: boolean;
  aoConfirmar: (dados: {
    cliente: ClienteDaLista;
    forma: FormaCombinada;
    momento: MomentoPagamento;
    observacoes: string;
  }) => void;
  fechando: boolean;
}) {
  const [cliente, setCliente] = useState<ClienteDaLista | null>(null);
  const [forma, setForma] = useState<FormaCombinada>("pix");
  const [momento, setMomento] = useState<MomentoPagamento>("agora");
  const [observacoes, setObservacoes] = useState("");

  const total = totalDoCarrinho(itens);
  const mandaPix = forma === "pix" && momento === "agora";

  function confirmar() {
    if (!cliente) {
      avisar.atencao("Escolha para quem é este pedido.");
      return;
    }

    aoConfirmar({ cliente, forma, momento, observacoes: observacoes.trim() });
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Fechar pedido"
      descricao={`${itens.length} ${itens.length === 1 ? "item" : "itens"}, ${moeda(total)}`}
      rodape={
        <>
          <Botao type="button" variante="secundario" onClick={aoFechar} disabled={fechando}>
            Voltar
          </Botao>
          <Botao type="button" onClick={confirmar} disabled={!cliente || fechando}>
            {fechando ? "Fechando o pedido..." : "Confirmar e mandar no WhatsApp"}
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-tinta-suave uppercase">
            Cliente do pedido
          </h3>
          <EscolherCliente clientes={clientes} escolhido={cliente} aoEscolher={setCliente} />
        </section>

        <section className="flex flex-col gap-4">
          <Escolha
            titulo="Forma de pagamento"
            opcoes={[
              { valor: "pix", rotulo: "PIX", detalhe: "Copia e cola" },
              { valor: "dinheiro", rotulo: "Dinheiro", detalhe: "Acerta pessoalmente" },
            ]}
            selecionado={forma}
            aoSelecionar={setForma}
          />

          <Escolha
            titulo="Quando paga"
            opcoes={[
              { valor: "agora", rotulo: "Pagar agora", detalhe: "Cobra no fechamento" },
              { valor: "na_entrega", rotulo: "Pagar na entrega", detalhe: "Cobra na entrega" },
            ]}
            selecionado={momento}
            aoSelecionar={setMomento}
          />

          {mandaPix ? (
            pixConfigurado ? (
              <p className="text-sm text-tinta-suave">
                A mensagem vai com o PIX copia e cola de {moeda(total)}, já com o valor dentro.
              </p>
            ) : (
              <p className="flex items-start gap-2 rounded-lg bg-atencao-suave p-3 text-sm text-atencao">
                <AlertTriangle size={16} aria-hidden className="mt-0.5 shrink-0" />
                <span>
                  Sua conta ainda não tem chave PIX em Ajustes, então a mensagem vai sem o copia e
                  cola. O pedido fecha do mesmo jeito.
                </span>
              </p>
            )
          ) : null}
        </section>

        <Campo
          rotulo="Observações"
          name="observacoes"
          placeholder="Opcional, só para você"
          value={observacoes}
          onChange={(evento) => setObservacoes(evento.target.value)}
        />

        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-tinta-suave uppercase">
            O que vai no pedido
          </h3>
          <ListaDoCarrinho itens={itens} somenteLeitura />
          <div className="mt-3 flex items-end justify-between border-t border-borda pt-3">
            <span className="text-xs font-semibold tracking-wide text-tinta-suave uppercase">
              Total
            </span>
            <span className="text-xl font-semibold tracking-tight text-tinta tabular-nums">
              {moeda(total)}
            </span>
          </div>
        </section>
      </div>
    </Modal>
  );
}

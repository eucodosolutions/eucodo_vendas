"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";

import { ListaDoCarrinho } from "./carrinho";
import { EscolherCliente, type ClienteDaLista } from "./escolher-cliente";
import { avisar } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { Escolha } from "@/components/ui/escolha";
import { Interruptor } from "@/components/ui/interruptor";
import { Modal } from "@/components/ui/modal";
import { totalDoCarrinho, type ItemDoCarrinho } from "@/lib/carrinho/carrinho";
import { moeda } from "@/lib/formato";
import type { FormaCombinada, MomentoPagamento } from "@/types/database";

/**
 * O fecho do pedido: para quem e, quando paga, como paga.
 *
 * As duas perguntas de pagamento sao separadas de proposito, e nesta ordem.
 * "Pagar agora" e a decisao que muda a conversa — ela diz se a cobranca sai
 * junto da mensagem; "PIX" so diz por onde o dinheiro entra. Perguntar a forma
 * primeiro fazia o vendedor escolher PIX e so depois descobrir que aquilo ainda
 * podia virar uma promessa para a semana que vem.
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
    avisarCliente: boolean;
    observacoes: string;
  }) => void;
  fechando: boolean;
}) {
  const [cliente, setCliente] = useState<ClienteDaLista | null>(null);
  const [momento, setMomento] = useState<MomentoPagamento>("agora");
  const [forma, setForma] = useState<FormaCombinada>("pix");
  const [avisarCliente, setAvisarCliente] = useState(true);
  const [observacoes, setObservacoes] = useState("");

  const total = totalDoCarrinho(itens);

  // A unica combinacao que promete cobranca dentro da mensagem, e a unica que
  // depende de Ajustes estar preenchido.
  const faltaChavePix = forma === "pix" && momento === "agora" && !pixConfigurado;

  // Fechar o popup no meio do envio apagaria o unico sinal de que o pedido
  // esta indo: a acao continua correndo, mas o vendedor volta para a vitrine
  // sem nada acontecendo na tela, e fecha o mesmo pedido de novo.
  function tentarFechar() {
    if (!fechando) aoFechar();
  }

  function confirmar() {
    if (!cliente) {
      avisar.atencao("Escolha para quem é este pedido.");
      return;
    }

    aoConfirmar({ cliente, forma, momento, avisarCliente, observacoes: observacoes.trim() });
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={tentarFechar}
      titulo="Fechar pedido"
      descricao={`${itens.length} ${itens.length === 1 ? "item" : "itens"}, ${moeda(total)}`}
      rodape={
        <>
          <Botao type="button" variante="secundario" onClick={tentarFechar} disabled={fechando}>
            Voltar
          </Botao>
          <Botao
            type="button"
            onClick={confirmar}
            disabled={!cliente}
            carregando={fechando}
            carregandoTexto="Fechando o pedido..."
          >
            {avisarCliente ? "Confirmar e mandar no WhatsApp" : "Confirmar sem avisar"}
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
            titulo="Quando paga"
            opcoes={[
              { valor: "agora", rotulo: "Pagar agora", detalhe: "Cobra no fechamento" },
              { valor: "na_entrega", rotulo: "Pagar na entrega", detalhe: "Cobra na entrega" },
            ]}
            selecionado={momento}
            aoSelecionar={setMomento}
          />

          <Escolha
            titulo="Forma de pagamento"
            opcoes={[
              { valor: "pix", rotulo: "PIX", detalhe: "Copia e cola" },
              { valor: "dinheiro", rotulo: "Dinheiro", detalhe: "Acerta pessoalmente" },
            ]}
            selecionado={forma}
            aoSelecionar={setForma}
          />

          {/* O aviso da chave que falta sai mesmo com o WhatsApp desligado: ele
              nao e sobre esta mensagem, e sobre o pedido nao guardar cobranca
              nenhuma para mandar depois. */}
          {faltaChavePix ? (
            <p className="flex items-start gap-2 rounded-lg bg-atencao-suave p-3 text-sm text-atencao">
              <AlertTriangle size={16} aria-hidden className="mt-0.5 shrink-0" />
              <span>
                Sua conta ainda não tem chave PIX em Ajustes, então o pedido fecha sem o copia e
                cola. O acerto vai ter que ser combinado na conversa.
              </span>
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-4 rounded-lg border border-borda bg-papel p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-tinta">Avisar o cliente no WhatsApp</p>
              <p className="mt-0.5 text-sm text-tinta-suave">
                {avisarCliente
                  ? mensagemDoCombinado({ forma, momento, total, pixConfigurado })
                  : "O pedido fecha calado. A mensagem continua a um toque na tela do pedido."}
              </p>
            </div>
            <Interruptor
              ligado={avisarCliente}
              rotulo="Avisar o cliente no WhatsApp"
              onChange={setAvisarCliente}
            />
          </div>
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

/**
 * O que a mensagem vai dizer, na frase de quem esta olhando a tela.
 *
 * Existe porque cada um dos quatro combinados manda um texto diferente para o
 * cliente, e o vendedor precisa saber qual antes de apertar o botao: ate aqui a
 * tela so falava do PIX a vista e ficava muda nos outros tres.
 */
function mensagemDoCombinado({
  forma,
  momento,
  total,
  pixConfigurado,
}: {
  forma: FormaCombinada;
  momento: MomentoPagamento;
  total: number;
  pixConfigurado: boolean;
}): string {
  if (forma === "dinheiro") {
    return momento === "agora"
      ? `A mensagem diz que o acerto é em dinheiro, ${moeda(total)}, agora no fechamento.`
      : `A mensagem diz que o acerto é em dinheiro, ${moeda(total)}, na hora da entrega.`;
  }

  if (momento === "na_entrega") {
    return "A mensagem diz que o PIX é na entrega, e que você manda o copia e cola na hora.";
  }

  return pixConfigurado
    ? `Depois da arte vai o PIX copia e cola de ${moeda(total)}, sozinho numa mensagem, para o cliente copiar de uma vez.`
    : "Sem chave PIX em Ajustes, a mensagem vai sem o copia e cola e deixa o acerto para a conversa.";
}

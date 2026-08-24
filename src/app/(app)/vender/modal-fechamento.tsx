"use client";

import { AlertTriangle, Check, Loader2 } from "lucide-react";
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

/** Em que passo do fechamento o servidor esta, do jeito que a tela conta. */
export type EtapaDoFechamento = "gravando" | "artes" | "cobranca" | "abrindo";

export type ProgressoDoFechamento = {
  etapa: EtapaDoFechamento;
  /** Chega no fim do primeiro passo. E o numero que o vendedor pode falar em voz alta. */
  codigo?: string;
  /** Quantas placas o pedido tem, e quantas ja estao desenhadas e gravadas. */
  placas: number;
  feitas: number;
};

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
  progresso,
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
  /** Nulo antes do clique. A partir dele, o passo em que o servidor esta. */
  progresso: ProgressoDoFechamento | null;
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

  const fechando = progresso !== null;

  // Fechar o popup no meio do envio apagaria o unico sinal de que o pedido
  // esta indo: os passos continuam correndo, mas o vendedor volta para a
  // vitrine sem nada acontecendo na tela, e fecha o mesmo pedido de novo.
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
      {progresso ? (
        <PassosDoFechamento
          progresso={progresso}
          ultimoPasso={rotuloDaCobranca({ forma, momento, avisarCliente })}
        />
      ) : (
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
      )}
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

/**
 * O que o servidor esta fazendo, enquanto faz.
 *
 * Fechar um pedido leva segundos de verdade, e o que assusta quem esta vendendo
 * nao e a espera: e a espera muda. Uma roda girando sobre um popup parado se le
 * como clique perdido, e o vendedor aperta de novo — que e pedido dobrado.
 * Lendo "desenhando a arte, 2 de 3", a mesma espera vira trabalho acontecendo,
 * e ainda da ao vendedor o que dizer para o cliente que esta na frente dele.
 *
 * Nenhum passo anda no relogio. Cada linha so vira concluida quando a chamada
 * daquele passo respondeu, entao a lista nunca chega no fim antes do servidor —
 * que e o jeito mais rapido de uma tela de progresso perder a confianca de quem
 * a le.
 */
function PassosDoFechamento({
  progresso,
  ultimoPasso,
}: {
  progresso: ProgressoDoFechamento;
  /** O que o passo da cobranca faz, que muda com o combinado desta venda. */
  ultimoPasso: string;
}) {
  const { etapa, codigo, placas, feitas } = progresso;

  const passos: Array<{ chave: EtapaDoFechamento; texto: string; feito: string }> = [
    {
      chave: "gravando",
      texto: "Gravando o pedido",
      feito: codigo ? `Pedido ${codigo} aberto` : "Pedido aberto",
    },
    // O pedido sem placa nenhuma nao passa por aqui, e a linha nem aparece:
    // prometer um desenho que nao vai acontecer e mentir sobre o proprio passo.
    ...(placas > 0
      ? [
          {
            chave: "artes" as const,
            texto:
              placas === 1
                ? "Desenhando a arte"
                : `Desenhando as artes (${Math.min(feitas + 1, placas)} de ${placas})`,
            feito: placas === 1 ? "Arte desenhada" : `${placas} artes desenhadas`,
          },
        ]
      : []),
    { chave: "cobranca", texto: ultimoPasso, feito: ultimoPasso },
    { chave: "abrindo", texto: "Abrindo a tela do pedido", feito: "Tela do pedido aberta" },
  ];

  const atual = passos.findIndex((passo) => passo.chave === etapa);

  return (
    // A altura minima segura o tamanho do popup no clique. Sem ela, a tela de
    // conferencia inteira some de uma vez e o popup desaba para uma tira de
    // quatro linhas — que e a impressao de quebrou, bem na hora de confiar.
    <div className="flex min-h-64 flex-col justify-center gap-5 py-2">
      <ol className="flex flex-col gap-3">
        {passos.map((passo, indice) => {
          const concluido = indice < atual;
          const correndo = indice === atual;

          return (
            <li key={passo.chave} className="flex items-center gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center">
                {concluido ? (
                  <Check size={16} aria-hidden className="text-sucesso" />
                ) : correndo ? (
                  <Loader2 size={16} aria-hidden className="animate-spin text-marca" />
                ) : (
                  <span className="size-1.5 rounded-full bg-borda-forte" aria-hidden />
                )}
              </span>

              <span
                className={
                  concluido
                    ? "text-sm text-tinta-suave"
                    : correndo
                      ? "text-sm font-medium text-tinta"
                      : "text-sm text-tinta-suave/70"
                }
              >
                {concluido ? passo.feito : passo.texto}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="rounded-lg bg-papel p-3 text-sm text-tinta-suave">
        Isso leva alguns segundos. Pode deixar esta tela aberta — o pedido já está gravado desde o
        primeiro passo.
      </p>
    </div>
  );
}

/**
 * O nome do passo da cobranca, que muda com o que foi combinado nesta venda.
 *
 * O passo faz duas coisas — guarda o PIX e manda a mensagem — mas nem sempre as
 * duas: sem PIX a vista nao ha copia e cola para montar, e com o aviso
 * desligado nao ha mensagem para sair. Escrever "montando o PIX" num pedido em
 * dinheiro seria a tela mentindo sobre o proprio trabalho.
 */
function rotuloDaCobranca({
  forma,
  momento,
  avisarCliente,
}: {
  forma: FormaCombinada;
  momento: MomentoPagamento;
  avisarCliente: boolean;
}): string {
  const temPix = forma === "pix" && momento === "agora";

  if (avisarCliente) {
    return temPix ? "Montando o PIX e mandando no WhatsApp" : "Mandando a mensagem no WhatsApp";
  }

  return temPix ? "Guardando o PIX do pedido" : "Fechando a conta do pedido";
}

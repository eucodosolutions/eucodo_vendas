"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type DragEvent } from "react";

import { CartaoDePedido } from "./cartao-de-pedido";
import { ConfirmacaoDeCancelamento } from "./confirmacao-de-cancelamento";
import { ConfirmacaoDeMovimento } from "./confirmacao-de-movimento";
import type { LinhaPedido } from "./linha";
import { EtiquetaStatus } from "@/components/etiquetas";
import { juntar } from "@/components/ui/controle";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { moeda, ROTULO_STATUS } from "@/lib/formato";
import { COLUNAS_DO_QUADRO, podeMover, PROXIMO_STATUS } from "@/lib/pedidos/fluxo";
import type { StatusPedido } from "@/types/database";

/**
 * Colunas que so crescem: pedido entregue e pedido cancelado nunca saem de la.
 * Depois de um ano de conta ativa, "Entregue" seria uma coluna de mil cartoes
 * que ninguem rola ate o fim — o quadro serve para ver o que ainda esta em pe.
 */
const FECHADAS: StatusPedido[] = ["entregue", "cancelado"];
const LIMITE_DAS_FECHADAS = 20;

type Movimento = { pedido: LinhaPedido; destino: StatusPedido };
type Aba = StatusPedido | "todos";

/**
 * Os pedidos do jeito que se trabalha com eles.
 *
 * Sao duas telas para o mesmo array, escolhidas por largura e nao por
 * JavaScript medindo a janela: o quadro de arrastar a partir de `lg`, onde cabe
 * coluna, e a lista com abas de status abaixo disso. As duas saem prontas do
 * servidor e o CSS decide qual aparece, entao ninguem ve a tela errada por um
 * quadro antes de trocar.
 *
 * O arrasto e o HTML5 nativo, sem biblioteca. Da para ser simples assim porque
 * ele nunca precisa funcionar no toque: celular e tablet em pe recebem a lista,
 * onde o cartao anda por botao. Navegador de celular nem implementa arrastar
 * por toque — `draggable` la nao faz nada, e nao atrapalha a rolagem.
 *
 * Nada aqui e otimista, de proposito. O padrao existe no painel (a lista de
 * produtos usa `useOptimistic` para o interruptor responder na hora), mas la a
 * acao e um toque e a resposta precisa ser imediata. Aqui toda mudanca passa
 * por uma confirmacao — a pausa ja esta la, e o `revalidatePath` da action
 * devolve a verdade do servidor logo depois. Antecipar so abriria espaco para o
 * cartao ficar numa coluna onde o banco nao o colocou.
 */
export function PedidosInterativos({
  pedidos,
  vista,
  ehVendedor,
}: {
  pedidos: LinhaPedido[];
  vista: "quadro" | "lista";
  /** O vendedor ve a comissao dele; o dono da conta ve o valor da venda. */
  ehVendedor: boolean;
}) {
  const [movimento, setMovimento] = useState<Movimento | null>(null);
  const [arrastando, setArrastando] = useState<LinhaPedido | null>(null);
  const [aba, setAba] = useState<Aba>("todos");

  const porStatus = useMemo(() => {
    const mapa = new Map<StatusPedido, LinhaPedido[]>();
    for (const status of COLUNAS_DO_QUADRO) mapa.set(status, []);
    // A consulta ja vem do mais novo para o mais velho, e agrupar preserva a
    // ordem: cada coluna nasce com o pedido recente no topo, sem reordenar nada.
    for (const pedido of pedidos) mapa.get(pedido.status)?.push(pedido);
    return mapa;
  }, [pedidos]);

  const daAba = aba === "todos" ? pedidos : (porStatus.get(aba) ?? []);
  const mostrarQuadro = vista === "quadro";

  function avancar(pedido: LinhaPedido, destino: StatusPedido) {
    setMovimento({ pedido, destino });
  }

  function soltar(coluna: StatusPedido) {
    if (!arrastando || !podeMover(arrastando.status, coluna)) return;
    setMovimento({ pedido: arrastando, destino: coluna });
    setArrastando(null);
  }

  return (
    <>
      {mostrarQuadro ? (
        <div className="hidden lg:block">
          {/* O `-mx-5` devolve o respiro lateral da pagina para a rolagem: as
              colunas correm de borda a borda em vez de terminarem num degrau. */}
          <div className="-mx-5 overflow-x-auto px-5 pb-2">
            <div className="flex min-w-max items-start gap-3">
              {COLUNAS_DO_QUADRO.map((coluna) => (
                <Coluna
                  key={coluna}
                  status={coluna}
                  pedidos={porStatus.get(coluna) ?? []}
                  ehVendedor={ehVendedor}
                  arrastando={arrastando}
                  aoSoltar={() => soltar(coluna)}
                  aoComecarArrasto={setArrastando}
                  aoTerminarArrasto={() => setArrastando(null)}
                  aoAvancar={avancar}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className={juntar("flex flex-col gap-4", mostrarQuadro && "lg:hidden")}>
        <Abas aba={aba} aoTrocar={setAba} porStatus={porStatus} total={pedidos.length} />

        {daAba.length === 0 ? (
          <EstadoVazio
            mensagem={
              aba === "todos"
                ? "Nenhum pedido por aqui."
                : `Nenhum pedido em ${ROTULO_STATUS[aba].toLowerCase()}.`
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {daAba.map((pedido) => (
              <li key={pedido.id}>
                <CartaoDePedido
                  pedido={pedido}
                  ehVendedor={ehVendedor}
                  acao={botaoAvancar(pedido, avancar)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Montada e desmontada, e nao so escondida: o estado da action e o do
          interruptor moram dentro da confirmacao, e reaproveitar a instancia
          faria o proximo pedido abrir com o resto do anterior. */}
      {movimento?.destino === "cancelado" ? (
        <ConfirmacaoDeCancelamento
          key={movimento.pedido.id}
          pedidoId={movimento.pedido.id}
          aoFechar={() => setMovimento(null)}
        />
      ) : null}

      {movimento && movimento.destino !== "cancelado" ? (
        <ConfirmacaoDeMovimento
          key={`${movimento.pedido.id}-${movimento.destino}`}
          pedidoId={movimento.pedido.id}
          codigo={movimento.pedido.codigo}
          de={movimento.pedido.status}
          para={movimento.destino}
          aoFechar={() => setMovimento(null)}
        />
      ) : null}
    </>
  );
}

function Coluna({
  status,
  pedidos,
  ehVendedor,
  arrastando,
  aoSoltar,
  aoComecarArrasto,
  aoTerminarArrasto,
  aoAvancar,
}: {
  status: StatusPedido;
  pedidos: LinhaPedido[];
  ehVendedor: boolean;
  arrastando: LinhaPedido | null;
  aoSoltar: () => void;
  aoComecarArrasto: (pedido: LinhaPedido) => void;
  aoTerminarArrasto: () => void;
  aoAvancar: (pedido: LinhaPedido, destino: StatusPedido) => void;
}) {
  const aceita = arrastando !== null && podeMover(arrastando.status, status);
  const total = pedidos.reduce((soma, pedido) => soma + pedido.total_centavos, 0);

  const corta = FECHADAS.includes(status) && pedidos.length > LIMITE_DAS_FECHADAS;
  const visiveis = corta ? pedidos.slice(0, LIMITE_DAS_FECHADAS) : pedidos;

  return (
    <section className="flex w-64 shrink-0 flex-col gap-2">
      <header className="flex items-center justify-between gap-2 px-1">
        <EtiquetaStatus status={status} />
        <span className="text-xs text-tinta-suave tabular-nums">
          {pedidos.length > 0 ? `${pedidos.length} · ${moeda(total)}` : "—"}
        </span>
      </header>

      <div
        // Sem `preventDefault` no `dragover` o navegador recusa o solte: e assim
        // que a coluna que nao aceita o cartao simplesmente nao o recebe.
        onDragOver={(evento: DragEvent<HTMLDivElement>) => {
          if (!aceita) return;
          evento.preventDefault();
          evento.dataTransfer.dropEffect = "move";
        }}
        onDrop={(evento: DragEvent<HTMLDivElement>) => {
          if (!aceita) return;
          evento.preventDefault();
          aoSoltar();
        }}
        className={juntar(
          "flex min-h-32 flex-1 flex-col gap-2 rounded-card border border-dashed p-2 transition-colors",
          aceita ? "border-marca bg-marca-suave" : "border-borda",
        )}
      >
        {visiveis.map((pedido) => (
          <CartaoDePedido
            key={pedido.id}
            pedido={pedido}
            ehVendedor={ehVendedor}
            compacto
            arrastavel={pedido.status !== "cancelado"}
            arrastando={arrastando?.id === pedido.id}
            aoComecarArrasto={(evento) => {
              // O texto nao e lido por ninguem: alguns navegadores so comecam o
              // arrasto quando ha algum dado no `dataTransfer`.
              evento.dataTransfer.effectAllowed = "move";
              evento.dataTransfer.setData("text/plain", pedido.codigo);
              aoComecarArrasto(pedido);
            }}
            aoTerminarArrasto={aoTerminarArrasto}
            acao={botaoAvancar(pedido, aoAvancar)}
          />
        ))}

        {visiveis.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-tinta-suave">
            {aceita ? "Solte aqui" : "Nada aqui"}
          </p>
        ) : null}

        {corta ? (
          <Link
            href="/pedidos?vista=lista"
            className="rounded-lg px-2 py-1.5 text-center text-xs font-medium text-marca hover:bg-marca-suave"
          >
            + {pedidos.length - LIMITE_DAS_FECHADAS} na lista
          </Link>
        ) : null}
      </div>
    </section>
  );
}

/**
 * O proximo passo, como botao — ou nada, quando nao ha proximo passo.
 *
 * E funcao, e nao componente, porque o cartao precisa saber da ausencia: um
 * componente que devolve `null` ainda e um elemento aos olhos de quem recebe a
 * prop, e o rodape do cartao apareceria vazio, com borda e tudo, em todo pedido
 * entregue ou cancelado.
 *
 * O botao e o unico caminho que funciona sem mouse, e por isso existe no quadro
 * tambem, e nao so na lista do celular: arrastar e atalho de quem tem mouse, e
 * um pedido que so anda arrastando seria um pedido que nao anda no teclado.
 */
function botaoAvancar(
  pedido: LinhaPedido,
  aoAvancar: (pedido: LinhaPedido, destino: StatusPedido) => void,
) {
  const proximo = PROXIMO_STATUS[pedido.status][0];
  if (!proximo) return undefined;

  const texto = `Marcar como ${ROTULO_STATUS[proximo].toLowerCase()}`;

  return (
    <button
      type="button"
      onClick={() => aoAvancar(pedido, proximo)}
      aria-label={`${texto} — pedido ${pedido.codigo}`}
      className="flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-marca transition-colors hover:bg-marca-suave"
    >
      {texto}
      <ArrowRight size={14} aria-hidden />
    </button>
  );
}

/**
 * O quadro deitado, para quando nao cabe coluna.
 *
 * Filtra em memoria porque a lista inteira ja esta aqui: uma ida ao servidor
 * para esconder cartoes que ja estao na tela seria meio segundo de espera por
 * nada, e o painel e usado no meio de uma conversa de venda.
 */
function Abas({
  aba,
  aoTrocar,
  porStatus,
  total,
}: {
  aba: Aba;
  aoTrocar: (aba: Aba) => void;
  porStatus: Map<StatusPedido, LinhaPedido[]>;
  total: number;
}) {
  const opcoes: Array<{ valor: Aba; texto: string; contagem: number }> = [
    { valor: "todos", texto: "Todos", contagem: total },
    ...COLUNAS_DO_QUADRO.map((status) => ({
      valor: status as Aba,
      texto: ROTULO_STATUS[status],
      contagem: porStatus.get(status)?.length ?? 0,
    })),
  ];

  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <div className="flex min-w-max gap-2">
        {opcoes.map((opcao) => {
          const ativa = opcao.valor === aba;
          return (
            <button
              key={opcao.valor}
              type="button"
              aria-pressed={ativa}
              onClick={() => aoTrocar(opcao.valor)}
              className={juntar(
                "flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium whitespace-nowrap transition-colors",
                ativa
                  ? "border-marca bg-marca text-white"
                  : "border-borda bg-superficie text-tinta-media hover:border-borda-forte",
              )}
            >
              {opcao.texto}
              <span className={juntar("tabular-nums", ativa ? "opacity-80" : "text-tinta-suave")}>
                {opcao.contagem}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

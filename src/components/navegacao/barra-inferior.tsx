"use client";

import { Ellipsis, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { dividirParaBarra, itemAtivo, itensDoPapel, type ItemDeMenu } from "./itens";
import { Modal } from "@/components/ui/modal";
import { pecasDoCarrinho } from "@/lib/carrinho/carrinho";
import { abrirCarrinho } from "@/lib/carrinho/gaveta";
import { useCarrinho } from "@/lib/carrinho/usar-carrinho";
import type { PapelUsuario } from "@/types/database";

const BOTAO =
  "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 transition-colors";

/**
 * Navegacao do celular, no rodape.
 *
 * Fica embaixo porque o painel e usado com uma mao so, no meio de uma conversa
 * de venda: o polegar alcanca o rodape, nao o topo. O `env(safe-area-inset-bottom)`
 * e o que impede os botoes de ficarem debaixo da barra do iPhone.
 *
 * Quatro botoes e o limite quando o carrinho esta na tela. O que nao cabe vai
 * para o "Mais", que abre a lista inteira em popup.
 *
 * O carrinho entra no meio da barra, como botao redondo levantado, em toda a
 * tela de venda. Ele ja foi uma barra flutuante logo acima daqui, e cobria o
 * preco e o "Adicionar" do produto que estava embaixo dela — o vendedor tinha
 * que rolar a vitrine para conseguir tocar no cartao. Levantado na barra, ele
 * nao cobre nada: a barra ja e area de navegacao.
 *
 * A navegacao conhecer o carrinho e proposital. A alternativa seria um contexto
 * atravessando o painel inteiro para entregar um botao a uma tela so.
 */
export function BarraInferior({ papel }: { papel: PapelUsuario }) {
  const caminho = usePathname();
  const [maisAberto, setMaisAberto] = useState(false);

  const { itens: doCarrinho } = useCarrinho();

  const itens = itensDoPapel(papel);
  const ativo = itemAtivo(itens, caminho);
  const { visiveis, extras } = dividirParaBarra(itens);

  const maisAceso = extras.some((item) => item.href === ativo);

  // So na tela de venda: e la que a gaveta vive, e um carrinho esquecido em
  // outra tela viraria um botao que abre coisa nenhuma. Vazio ele continua na
  // barra, porque quem chega precisa saber onde o carrinho fica antes de ter o
  // primeiro item — sumir ate a primeira peca deixava a tela sem carrinho
  // nenhum justamente para quem ainda nao conhece o painel.
  const pecas = pecasDoCarrinho(doCarrinho);
  const comCarrinho = caminho === "/vender";

  // A fila da barra: o que coube mais o "Mais". O carrinho nao entra aqui — ele
  // parte a fila em duas metades e fica preso no centro exato da tela.
  const fila: ReactNode[] = visiveis.map((item) => (
    <BotaoDeItem key={item.href} item={item} aceso={ativo === item.href} />
  ));

  if (extras.length > 0) {
    fila.push(
      <button
        key="mais"
        type="button"
        onClick={() => setMaisAberto(true)}
        aria-expanded={maisAberto}
        className={`${BOTAO} ${maisAceso ? "text-marca" : "text-tinta-suave"}`}
      >
        <Ellipsis size={20} aria-hidden />
        <span className="text-[0.6875rem] leading-none font-medium">Mais</span>
      </button>,
    );
  }

  const meio = Math.ceil(fila.length / 2);

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-borda bg-superficie pb-[env(safe-area-inset-bottom)] md:hidden">
        {comCarrinho ? (
          // As duas metades sao `flex-1` iguais e o carrinho tem largura fixa
          // entre elas: e isso que poe o circulo no meio da tela, e nao no meio
          // de uma fila que muda de tamanho conforme o papel de quem entrou.
          <>
            <div className="flex flex-1">{fila.slice(0, meio)}</div>
            <CarrinhoNaBarra pecas={pecas} />
            <div className="flex flex-1">{fila.slice(meio)}</div>
          </>
        ) : (
          <div className="flex flex-1">{fila}</div>
        )}
      </nav>

      <Modal
        aberto={maisAberto}
        aoFechar={() => setMaisAberto(false)}
        titulo="Mais"
        tamanho="estreito"
      >
        <ul className="flex flex-col gap-1">
          {extras.map((item) => {
            const Icone = item.icone;
            const aceso = ativo === item.href;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={aceso ? "page" : undefined}
                  // Fecha no toque, e nao num efeito que observa a rota: a
                  // troca de pagina e a mesma acao, e esperar o roteador
                  // deixaria a lista por cima da tela nova por um instante.
                  onClick={() => setMaisAberto(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors ${
                    aceso ? "bg-marca-suave text-marca" : "text-tinta hover:bg-papel"
                  }`}
                >
                  <Icone size={18} aria-hidden />
                  {item.rotulo}
                </Link>
              </li>
            );
          })}
        </ul>
      </Modal>
    </>
  );
}

/**
 * O carrinho levantado no centro da barra.
 *
 * O circulo transborda a barra de proposito: assim ele se le como acao, e nao
 * como o destino do meio do menu. A borda da cor da barra e o que separa o
 * circulo do conteudo da pagina que passa por tras dele.
 *
 * Embaixo nao vai nada. O total ja aparece no cabecalho da gaveta e no popup de
 * fechar, e repetido aqui ele so servia para alargar a fatia do carrinho num
 * pedido de quatro digitos e empurrar os vizinhos.
 */
function CarrinhoNaBarra({ pecas }: { pecas: number }) {
  return (
    <div className="relative w-16 shrink-0">
      <button
        type="button"
        onClick={abrirCarrinho}
        aria-label={
          pecas === 0
            ? "Ver carrinho, vazio"
            : `Ver carrinho, ${pecas} ${pecas === 1 ? "peça" : "peças"}`
        }
        className="absolute -top-7 left-1/2 flex size-14 -translate-x-1/2 items-center justify-center rounded-full border-4 border-superficie bg-marca text-white shadow-lg transition-transform active:scale-95"
      >
        <ShoppingCart size={22} aria-hidden />
        {pecas > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-tinta px-1 text-[0.625rem] leading-none font-bold tabular-nums">
            {pecas}
          </span>
        ) : null}
      </button>
    </div>
  );
}

function BotaoDeItem({ item, aceso }: { item: ItemDeMenu; aceso: boolean }) {
  const Icone = item.icone;

  return (
    <Link
      href={item.href}
      aria-current={aceso ? "page" : undefined}
      className={`${BOTAO} ${aceso ? "text-marca" : "text-tinta-suave"}`}
    >
      <Icone size={20} aria-hidden />
      <span className="text-[0.6875rem] leading-none font-medium">{item.rotulo}</span>
    </Link>
  );
}

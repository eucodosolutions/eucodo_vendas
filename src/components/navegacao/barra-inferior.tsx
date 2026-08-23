"use client";

import { Ellipsis, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { dividirParaBarra, itemAtivo, itensDoPapel, type ItemDeMenu } from "./itens";
import { Modal } from "@/components/ui/modal";
import { pecasDoCarrinho, totalDoCarrinho } from "@/lib/carrinho/carrinho";
import { abrirCarrinho } from "@/lib/carrinho/gaveta";
import { useCarrinho } from "@/lib/carrinho/usar-carrinho";
import { moeda } from "@/lib/formato";
import type { PapelUsuario } from "@/types/database";

const BOTAO =
  "flex min-h-14 w-full flex-col items-center justify-center gap-1 px-1 py-2 transition-colors";

/**
 * Navegacao do celular, no rodape.
 *
 * Fica embaixo porque o painel e usado com uma mao so, no meio de uma conversa
 * de venda: o polegar alcanca o rodape, nao o topo. O `env(safe-area-inset-bottom)`
 * e o que impede os botoes de ficarem debaixo da barra do iPhone.
 *
 * Cinco botoes e o limite: com seis, cada alvo fica menor que o dedo. O que nao
 * cabe vai para o "Mais", que abre a lista inteira em popup.
 *
 * O carrinho entra no meio da barra, como botao redondo levantado, enquanto a
 * tela de venda tem item. Ele ja foi uma barra flutuante logo acima daqui, e
 * cobria o preco e o "Adicionar" do produto que estava embaixo dela — o
 * vendedor tinha que rolar a vitrine para conseguir tocar no cartao. Levantado
 * na barra, ele nao cobre nada: a barra ja e area de navegacao.
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
  // outra tela viraria um botao que abre coisa nenhuma.
  const pecas = pecasDoCarrinho(doCarrinho);
  const comCarrinho = caminho === "/vender" && pecas > 0;

  // O carrinho parte a fila no meio para nascer do centro da barra, e nao
  // encostado num dos lados.
  const meio = comCarrinho ? Math.ceil(visiveis.length / 2) : visiveis.length;

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-borda bg-superficie pb-[env(safe-area-inset-bottom)] md:hidden">
        <ul className="flex">
          {visiveis.slice(0, meio).map((item) => (
            <li key={item.href} className="flex-1">
              <BotaoDeItem item={item} aceso={ativo === item.href} />
            </li>
          ))}

          {comCarrinho ? (
            // `min-w-0`: o total e o unico texto da barra que pode crescer, e
            // sem isso um pedido de quatro digitos alargaria a fatia dele e
            // empurraria os vizinhos.
            <li className="flex min-w-0 flex-1">
              <BotaoDoCarrinho pecas={pecas} total={totalDoCarrinho(doCarrinho)} />
            </li>
          ) : null}

          {visiveis.slice(meio).map((item) => (
            <li key={item.href} className="flex-1">
              <BotaoDeItem item={item} aceso={ativo === item.href} />
            </li>
          ))}

          {extras.length > 0 ? (
            <li className="flex-1">
              <button
                type="button"
                onClick={() => setMaisAberto(true)}
                aria-expanded={maisAberto}
                className={`${BOTAO} ${maisAceso ? "text-marca" : "text-tinta-suave"}`}
              >
                <Ellipsis size={20} aria-hidden />
                <span className="text-[0.6875rem] leading-none font-medium">Mais</span>
              </button>
            </li>
          ) : null}
        </ul>
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
 * O carrinho levantado no meio da barra.
 *
 * O circulo transborda a barra de proposito: assim ele se le como acao, e nao
 * como o destino do meio do menu. A borda da cor da barra e o que separa o
 * circulo do conteudo da pagina que passa por tras dele.
 *
 * O total fica embaixo, no lugar do rotulo dos vizinhos: e o numero que o
 * vendedor confere antes de fechar, e ele nao cabe dentro do circulo.
 */
function BotaoDoCarrinho({ pecas, total }: { pecas: number; total: number }) {
  return (
    <div className="relative flex min-w-0 flex-1 flex-col items-center justify-end gap-1 px-1 pb-2">
      <button
        type="button"
        onClick={abrirCarrinho}
        aria-label={`Ver carrinho, ${pecas} ${pecas === 1 ? "peça" : "peças"}, ${moeda(total)}`}
        className="absolute -top-7 left-1/2 flex size-14 -translate-x-1/2 items-center justify-center rounded-full border-4 border-superficie bg-marca text-white shadow-lg transition-transform active:scale-95"
      >
        <ShoppingCart size={22} aria-hidden />
        <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-tinta px-1 text-[0.625rem] leading-none font-bold tabular-nums">
          {pecas}
        </span>
      </button>

      <span className="w-full truncate text-center text-[0.6875rem] leading-none font-semibold text-marca tabular-nums">
        {moeda(total)}
      </span>
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

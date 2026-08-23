"use client";

import { ShoppingCart } from "lucide-react";

import { Botao } from "@/components/ui/botao";
import { pecasDoCarrinho, totalDoCarrinho } from "@/lib/carrinho/carrinho";
import { abrirCarrinho } from "@/lib/carrinho/gaveta";
import { useCarrinho } from "@/lib/carrinho/usar-carrinho";
import { moeda } from "@/lib/formato";

/**
 * O carrinho no canto do cabecalho, no computador.
 *
 * Ele ja foi uma barra flutuante no rodape da tela, e no monitor ela cobria
 * justamente a linha de baixo da vitrine: o "Adicionar" do produto ficava
 * atras do proprio carrinho. Aqui em cima ele nao disputa espaco com nada, e
 * acompanha o cabecalho, que fica preso no topo enquanto a vitrine rola.
 *
 * No celular quem faz este papel e o botao redondo do meio da barra de baixo,
 * que e onde o polegar ja esta.
 *
 * Aparece mesmo com o carrinho vazio, e por isso e mais discreto nesse estado:
 * quem chega na tela precisa saber onde o carrinho fica antes de ter um item.
 */
export function BotaoDoCarrinho() {
  const { itens } = useCarrinho();
  const pecas = pecasDoCarrinho(itens);

  return (
    <div className="hidden md:block">
      <Botao
        type="button"
        variante={pecas > 0 ? "primario" : "secundario"}
        onClick={abrirCarrinho}
      >
        <ShoppingCart size={16} aria-hidden />
        {pecas === 0 ? (
          "Carrinho vazio"
        ) : (
          <>
            <span>
              {pecas} {pecas === 1 ? "peça" : "peças"}
            </span>
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-sm font-semibold tabular-nums">
              {moeda(totalDoCarrinho(itens))}
            </span>
          </>
        )}
      </Botao>
    </div>
  );
}

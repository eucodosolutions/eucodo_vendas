"use client";

import { ListaDoCarrinho } from "./carrinho";
import { Botao } from "@/components/ui/botao";
import { Gaveta } from "@/components/ui/gaveta";
import { pecasDoCarrinho, totalDoCarrinho, type ItemDoCarrinho } from "@/lib/carrinho/carrinho";
import { moeda } from "@/lib/formato";

/**
 * O carrinho encostado na lateral, com o total e o botao de fechar no rodape.
 *
 * O rodape e fixo de proposito: com seis placas na lista, o total e o
 * "Finalizar" sairiam da tela justamente no pedido grande, que e onde conferir
 * o valor antes de mandar importa mais.
 */
export function GavetaDoCarrinho({
  aberta,
  aoFechar,
  itens,
  aoRemover,
  aoMudarQuantidade,
  aoLimpar,
  aoFinalizar,
}: {
  aberta: boolean;
  aoFechar: () => void;
  itens: ItemDoCarrinho[];
  aoRemover: (chave: string) => void;
  aoMudarQuantidade: (chave: string, quantidade: number) => void;
  aoLimpar: () => void;
  aoFinalizar: () => void;
}) {
  const pecas = pecasDoCarrinho(itens);
  const vazio = itens.length === 0;

  return (
    <Gaveta
      aberta={aberta}
      aoFechar={aoFechar}
      titulo="Carrinho"
      descricao={vazio ? undefined : `${pecas} ${pecas === 1 ? "peça" : "peças"}`}
      rodape={
        vazio ? undefined : (
          <div className="flex flex-col gap-3">
            <div className="flex items-end justify-between">
              <span className="text-xs font-semibold tracking-wide text-tinta-suave uppercase">
                Total do pedido
              </span>
              <span className="text-2xl font-semibold tracking-tight text-tinta tabular-nums">
                {moeda(totalDoCarrinho(itens))}
              </span>
            </div>

            <Botao type="button" larguraTotal onClick={aoFinalizar}>
              Finalizar pedido
            </Botao>

            <button
              type="button"
              onClick={aoLimpar}
              className="self-center text-sm font-medium text-tinta-suave hover:text-erro hover:underline"
            >
              Esvaziar carrinho
            </button>
          </div>
        )
      }
    >
      {vazio ? (
        <p className="py-8 text-center text-sm text-tinta-suave">
          Carrinho vazio. Escolha um produto na vitrine e toque em Adicionar.
        </p>
      ) : (
        <ListaDoCarrinho
          itens={itens}
          aoRemover={aoRemover}
          aoMudarQuantidade={aoMudarQuantidade}
        />
      )}
    </Gaveta>
  );
}

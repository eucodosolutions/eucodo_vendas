"use client";

import { useSyncExternalStore } from "react";

/**
 * Se o carrinho esta aberto, num store de modulo.
 *
 * Estado de tela normalmente mora no componente, e este morava. O que tirou ele
 * de la foi o botao do celular: ele passou a ser o botao redondo do meio da
 * barra de baixo, que e navegacao e vive fora da tela de venda. Sem um ponto
 * comum, a barra precisaria de um caminho ate o `useState` da venda — contexto
 * novo so para isso, ou um callback registrado no meio do caminho.
 *
 * O carrinho ao lado ja funciona assim (`usar-carrinho.ts`), pelo mesmo motivo:
 * quem abre e quem mostra nem sempre sao a mesma parte da tela.
 */

let aberta = false;
const ouvintes = new Set<() => void>();

function assinar(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

function definir(valor: boolean) {
  if (aberta === valor) return;
  aberta = valor;
  for (const ouvinte of ouvintes) ouvinte();
}

export function abrirCarrinho() {
  definir(true);
}

/**
 * Fecha, e tambem e o que a tela de venda chama ao sair.
 *
 * O estado vive fora do React e sobrevive a troca de pagina: sem essa limpeza,
 * quem voltasse do botao "voltar" do navegador com a gaveta aberta reencontraria
 * ela aberta na proxima visita.
 */
export function fecharCarrinho() {
  definir(false);
}

export function useCarrinhoAberto(): boolean {
  return useSyncExternalStore(
    assinar,
    () => aberta,
    () => false,
  );
}

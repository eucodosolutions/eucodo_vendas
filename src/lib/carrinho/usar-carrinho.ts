"use client";

import { useCallback, useSyncExternalStore } from "react";

import { guardarCarrinho, lerCarrinhoGuardado, type ItemDoCarrinho } from "./carrinho";

/**
 * O carrinho vive no navegador, nao no banco.
 *
 * Ele existe por dois minutos no meio de uma conversa de venda. Uma tabela para
 * isso significaria uma ida ao servidor a cada toque, exatamente no momento em
 * que o sistema precisa ser rapido. O `localStorage` cobre o que importa: se o
 * navegador fechar ou a tela travar, o carrinho volta.
 *
 * O estado mora fora do React, num store de modulo, e entra por
 * `useSyncExternalStore`. Ler `localStorage` dentro de um efeito e chamar
 * `setState` funcionaria, mas custa um render a mais em toda montagem e e
 * exatamente o caso que este hook do React existe para resolver.
 */

let guardado: ItemDoCarrinho[] | null = null;
const ouvintes = new Set<() => void>();

/** O servidor nao tem carrinho. Referencia fixa, senao o React re-renderiza sem fim. */
const VAZIO: ItemDoCarrinho[] = [];

function instantaneo(): ItemDoCarrinho[] {
  if (guardado === null) guardado = lerCarrinhoGuardado();
  return guardado;
}

function instantaneoDoServidor(): ItemDoCarrinho[] {
  return VAZIO;
}

function assinar(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

function definir(proximos: ItemDoCarrinho[]) {
  guardado = proximos;
  guardarCarrinho(proximos);
  for (const ouvinte of ouvintes) ouvinte();
}

/**
 * Esvazia o carrinho de fora do React.
 *
 * Quem chama e a tela do pedido recem-criado: e o unico ponto em que o pedido
 * comprovadamente existe. Precisa passar pelo store, e nao so pelo
 * `localStorage`, senao voltar para a venda sem recarregar a pagina mostraria o
 * carrinho antigo que ficou em memoria.
 */
export function esvaziarCarrinho() {
  definir([]);
}

function negocio(nome?: string): string {
  return (nome ?? "").trim().toLowerCase();
}

export function useCarrinho() {
  const itens = useSyncExternalStore(assinar, instantaneo, instantaneoDoServidor);

  const adicionar = useCallback((item: Omit<ItemDoCarrinho, "chave">) => {
    const atuais = instantaneo();

    // O mesmo produto, na mesma cor e para a mesma empresa, vira quantidade e
    // nao linha repetida.
    //
    // O cadastro entra na comparacao junto com o nome impresso, e nao no lugar
    // dele: duas filiais podem estar cadastradas com o mesmo nome, e ai sao
    // dois negocios, dois links e duas linhas. O nome sozinho as juntaria numa
    // placa so, com o QR de uma delas.
    const igual = atuais.findIndex(
      (linha) =>
        linha.produtoId === item.produtoId &&
        linha.cor === item.cor &&
        linha.negocioId === item.negocioId &&
        negocio(linha.nomeNegocio) === negocio(item.nomeNegocio),
    );

    if (igual >= 0) {
      const copia = [...atuais];
      copia[igual] = { ...copia[igual], quantidade: copia[igual].quantidade + item.quantidade };
      definir(copia);
      return;
    }

    definir([...atuais, { ...item, chave: crypto.randomUUID() }]);
  }, []);

  const remover = useCallback((chave: string) => {
    definir(instantaneo().filter((item) => item.chave !== chave));
  }, []);

  const mudarQuantidade = useCallback((chave: string, quantidade: number) => {
    const nova = Math.max(1, Math.min(999, Math.trunc(quantidade) || 1));
    definir(
      instantaneo().map((item) => (item.chave === chave ? { ...item, quantidade: nova } : item)),
    );
  }, []);

  const limpar = useCallback(() => definir([]), []);

  return { itens, adicionar, remover, mudarQuantidade, limpar };
}

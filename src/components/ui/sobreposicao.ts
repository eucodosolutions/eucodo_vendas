"use client";

import { useCallback, useEffect, useRef, type KeyboardEvent } from "react";

/** O que o navegador aceita focar por tabulacao dentro da sobreposicao. */
const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let abertas = 0;
let rolagemOriginal = "";

/**
 * Trava a rolagem do fundo enquanto houver sobreposicao aberta.
 *
 * A conta e de modulo, e nao de componente, porque elas se empilham: o
 * fechamento do pedido abre por cima da gaveta do carrinho. Com uma trava por
 * componente, as duas desmontam no mesmo passo, a ultima a limpar devolve o
 * `hidden` que a primeira tinha guardado, e a pagina fica sem rolar ate o F5.
 */
function travarRolagem(): () => void {
  if (abertas === 0) {
    rolagemOriginal = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }

  abertas += 1;

  return () => {
    abertas -= 1;
    if (abertas === 0) document.body.style.overflow = rolagemOriginal;
  };
}

/**
 * O comportamento que popup e gaveta tem igual: foco preso dentro, Escape
 * fecha, rolagem do fundo travada e foco devolvido a quem abriu.
 *
 * Mora num hook porque sao as partes chatas de acertar, e uma segunda copia
 * delas na gaveta seria a copia que envelhece torto. O que muda entre as duas e
 * so a moldura, e moldura e classe de CSS.
 */
export function useSobreposicao(aberto: boolean, aoFechar: () => void) {
  const caixa = useRef<HTMLDivElement>(null);
  const focoAnterior = useRef<HTMLElement | null>(null);

  // Guarda de onde a pessoa veio e devolve o foco ao fechar. Sem isto, quem
  // abriu pelo teclado volta para o comeco da pagina.
  useEffect(() => {
    if (!aberto) return;

    focoAnterior.current = document.activeElement as HTMLElement | null;
    const primeiro = caixa.current?.querySelector<HTMLElement>(FOCAVEIS);
    (primeiro ?? caixa.current)?.focus();

    return () => focoAnterior.current?.focus();
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    return travarRolagem();
  }, [aberto]);

  const aoTeclar = useCallback(
    (evento: KeyboardEvent<HTMLDivElement>) => {
      if (evento.key === "Escape") {
        evento.stopPropagation();
        aoFechar();
        return;
      }

      if (evento.key !== "Tab") return;

      const alvos = Array.from(caixa.current?.querySelectorAll<HTMLElement>(FOCAVEIS) ?? []);
      if (alvos.length === 0) return;

      const primeiro = alvos[0];
      const ultimo = alvos[alvos.length - 1];
      const atual = document.activeElement;

      // Tab no ultimo volta para o primeiro, e Shift+Tab no primeiro vai para o
      // ultimo: e isso que impede o foco de escapar para a pagina atras.
      if (!evento.shiftKey && atual === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      } else if (evento.shiftKey && atual === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      }
    },
    [aoFechar],
  );

  return { caixa, aoTeclar };
}

"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";

import { juntar } from "./controle";

const LARGURAS = {
  estreito: "sm:max-w-md",
  medio: "sm:max-w-xl",
  largo: "sm:max-w-3xl",
} as const;

/** O que o navegador aceita focar por tabulacao dentro do popup. */
const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let popupsAbertos = 0;
let rolagemOriginal = "";

/**
 * Trava a rolagem do fundo enquanto houver popup aberto.
 *
 * A conta e de modulo, e nao de componente, porque os popups se empilham: a
 * confirmacao de remover produto abre por cima do cadastro dele. Com uma trava
 * por componente, os dois desmontam no mesmo passo, o ultimo a limpar devolve o
 * `hidden` que o primeiro tinha guardado, e a pagina fica sem rolar ate o F5.
 */
function travarRolagem(): () => void {
  if (popupsAbertos === 0) {
    rolagemOriginal = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }

  popupsAbertos += 1;

  return () => {
    popupsAbertos -= 1;
    if (popupsAbertos === 0) document.body.style.overflow = rolagemOriginal;
  };
}

type ModalProps = {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  children: ReactNode;
  /** Barra de acoes presa no rodape: rola o conteudo, nao os botoes. */
  rodape?: ReactNode;
  tamanho?: keyof typeof LARGURAS;
};

/**
 * Popup padrao do sistema. Todo cadastro e toda edicao passam por aqui.
 *
 * Nao e o `<dialog>` nativo, e a escolha custou uma armadilha de foco escrita a
 * mao. O `showModal()` joga o elemento na top layer do navegador, que fica
 * acima de tudo que nao esteja nela: o toast do sonner sumiria atras do popup
 * justamente nas telas onde o formulario avisa que algo deu errado. Como neste
 * projeto todo aviso e toast, quem cede e o popup.
 *
 * No celular ele cola no rodape e ocupa quase a tela toda, pela mesma razao da
 * barra de navegacao ficar embaixo: o painel e usado com uma mao so, no meio de
 * uma conversa de venda, e o polegar nao alcanca o topo.
 */
export function Modal({
  aberto,
  aoFechar,
  titulo,
  descricao,
  children,
  rodape,
  tamanho = "medio",
}: ModalProps) {
  const caixa = useRef<HTMLDivElement>(null);
  const focoAnterior = useRef<HTMLElement | null>(null);
  const idDoTitulo = useId();

  // Guarda de onde a pessoa veio e devolve o foco ao fechar. Sem isto, quem
  // abriu o popup pelo teclado volta para o comeco da pagina.
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

  if (!aberto) return null;

  return (
    <div
      // z-50 passa por cima da navegacao (z-30) e do convite do PWA (z-40). O
      // toast do sonner vem bem acima disso e continua visivel, como deve.
      className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/40 p-0 sm:items-center sm:p-6"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) aoFechar();
      }}
    >
      <div
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idDoTitulo}
        tabIndex={-1}
        onKeyDown={aoTeclar}
        className={juntar(
          "flex max-h-[92dvh] w-full flex-col overflow-hidden border border-borda bg-superficie",
          "rounded-t-card sm:rounded-card",
          LARGURAS[tamanho],
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-borda p-5">
          <div className="min-w-0">
            <h2 id={idDoTitulo} className="text-base font-semibold text-tinta">
              {titulo}
            </h2>
            {descricao ? <p className="mt-1 text-sm text-tinta-suave">{descricao}</p> : null}
          </div>

          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="-mt-1 -mr-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-tinta-suave transition-colors hover:bg-marca-suave hover:text-tinta"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>

        {rodape ? (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-borda p-5">
            {rodape}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { X } from "lucide-react";
import { useId, type ReactNode } from "react";

import { useSobreposicao } from "./sobreposicao";

type GavetaProps = {
  aberta: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  children: ReactNode;
  /** Barra presa no rodape: o total e o botao de fechar o pedido nao rolam. */
  rodape?: ReactNode;
};

/**
 * Painel que entra pela direita, colado na altura inteira da tela.
 *
 * E a moldura do carrinho. Popup centralizado serve para uma decisao curta que
 * comeca e termina ali; o carrinho e uma lista que a pessoa consulta enquanto
 * continua escolhendo na vitrine atras, e por isso ele encosta na lateral em
 * vez de cobrir o meio da tela.
 *
 * No celular ocupa a largura toda: nao ha lateral que sobre num aparelho de
 * 390px, e meia tela deixaria a lista de itens espremida.
 */
export function Gaveta({ aberta, aoFechar, titulo, descricao, children, rodape }: GavetaProps) {
  const { caixa, aoTeclar } = useSobreposicao(aberta, aoFechar);
  const idDoTitulo = useId();

  if (!aberta) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-tinta/40"
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
        className="flex h-full w-full max-w-md flex-col border-l border-borda bg-superficie"
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
            aria-label="Fechar o carrinho"
            className="-mt-1 -mr-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-tinta-suave transition-colors hover:bg-marca-suave hover:text-tinta"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>

        {rodape ? <footer className="border-t border-borda p-5">{rodape}</footer> : null}
      </div>
    </div>
  );
}

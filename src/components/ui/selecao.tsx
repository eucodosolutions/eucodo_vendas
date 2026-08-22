"use client";

import { ChevronDown } from "lucide-react";
import { useId, type SelectHTMLAttributes } from "react";

import { ALTURA_CONTROLE, BORDA_NORMAL, juntar, MOLDURA_CONTROLE } from "./controle";

type SelecaoProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "className" | "children"> & {
  rotulo: string;
  /** Esconde o rotulo visualmente, quando o contexto ao lado ja explica. */
  rotuloOculto?: boolean;
  opcoes: Array<{ valor: string; texto: string }>;
};

export function Selecao({ rotulo, rotuloOculto, opcoes, id, ...props }: SelecaoProps) {
  const gerado = useId();
  const campoId = id ?? props.name ?? gerado;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={campoId}
        className={rotuloOculto ? "sr-only" : "text-rotulo font-medium text-tinta"}
      >
        {rotulo}
      </label>
      <div className="relative">
        <select
          {...props}
          id={campoId}
          className={juntar(
            MOLDURA_CONTROLE,
            ALTURA_CONTROLE,
            BORDA_NORMAL,
            "appearance-none pr-9 pl-3",
          )}
        >
          {opcoes.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.texto}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-tinta-suave"
        />
      </div>
    </div>
  );
}

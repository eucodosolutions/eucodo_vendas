"use client";

import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes } from "react";

import { ALTURA_CONTROLE, juntar } from "./controle";

type BotaoProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  variante?: "primario" | "secundario" | "fantasma" | "sucesso";
  carregandoTexto?: string;
  larguraTotal?: boolean;
};

const ESTILOS = {
  primario: "bg-marca text-white hover:bg-marca-escura disabled:bg-marca/50",
  secundario:
    "bg-superficie text-tinta border border-borda-forte hover:border-tinta-suave disabled:opacity-50",
  fantasma: "bg-transparent text-marca hover:bg-marca-suave disabled:opacity-50",
  sucesso: "bg-sucesso text-white hover:opacity-90 disabled:opacity-50",
} as const;

/**
 * Botao de formulario. Dentro de um <form> com server action ele mesmo escuta o
 * envio e trava o duplo clique, que num painel de vendas seria pedido dobrado.
 */
export function Botao({
  variante = "primario",
  carregandoTexto,
  larguraTotal,
  children,
  disabled,
  ...props
}: BotaoProps) {
  const { pending } = useFormStatus();
  const travado = disabled || (pending && props.type !== "button");

  return (
    <button
      {...props}
      disabled={travado}
      className={juntar(
        ALTURA_CONTROLE,
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium whitespace-nowrap transition-colors",
        ESTILOS[variante],
        larguraTotal && "w-full",
      )}
    >
      {travado && carregandoTexto ? carregandoTexto : children}
    </button>
  );
}

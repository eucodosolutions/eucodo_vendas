"use client";

import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes } from "react";

type BotaoProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "primario" | "secundario" | "fantasma";
  carregandoTexto?: string;
};

const ESTILOS = {
  primario: "bg-marca text-white hover:bg-marca-escura disabled:bg-marca/50",
  secundario:
    "bg-superficie text-tinta border border-borda-forte hover:border-tinta-suave disabled:opacity-50",
  fantasma: "bg-transparent text-marca hover:bg-marca-suave disabled:opacity-50",
} as const;

/**
 * Botao de formulario. Quando esta dentro de um <form> com server action, ele
 * mesmo escuta o envio e trava o duplo clique, que num painel de vendas
 * significaria pedido duplicado.
 */
export function Botao({
  variante = "primario",
  carregandoTexto,
  children,
  className = "",
  disabled,
  ...props
}: BotaoProps) {
  const { pending } = useFormStatus();
  const travado = disabled || (pending && props.type !== "button");

  return (
    <button
      {...props}
      disabled={travado}
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-lg px-5 text-base font-medium transition-colors disabled:cursor-not-allowed ${ESTILOS[variante]} ${className}`}
    >
      {travado && carregandoTexto ? carregandoTexto : children}
    </button>
  );
}

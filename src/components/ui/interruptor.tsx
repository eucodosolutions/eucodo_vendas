"use client";

import { juntar } from "./controle";

/**
 * Liga e desliga uma coisa so, na propria lista.
 *
 * Existe porque decisao de um bit nao merece formulario: tirar um produto da
 * venda e um toque, e nao abrir popup, mudar campo e salvar. Sai como `button`
 * com `role="switch"`, e nao como checkbox, porque ele age na hora — nao ha
 * "salvar" depois dele.
 *
 * O rotulo e obrigatorio e invisivel: na lista quem explica o que esta sendo
 * ligado e a linha inteira, mas o leitor de tela ouve so o controle.
 */
export function Interruptor({
  ligado,
  rotulo,
  onChange,
  disabled,
}: {
  ligado: boolean;
  rotulo: string;
  onChange: (ligado: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      disabled={disabled}
      onClick={() => onChange(!ligado)}
      className={juntar(
        "relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-50",
        ligado ? "bg-marca" : "bg-borda-forte",
      )}
    >
      <span
        aria-hidden
        className={juntar(
          "absolute top-0.5 left-0.5 size-5 rounded-full bg-superficie shadow-sm transition-transform",
          ligado && "translate-x-5",
        )}
      />
    </button>
  );
}

"use client";

import { Search } from "lucide-react";
import type { ChangeEvent } from "react";

import { ALTURA_CONTROLE, BORDA_NORMAL, juntar, MOLDURA_CONTROLE } from "./controle";

/**
 * Caixa de busca com a lupa dentro.
 *
 * Nao usa o `Campo` porque ali o rotulo e obrigatorio e desenhado por cima: uma
 * busca com titulo escrito ocupa altura que a lista precisa mais. O nome do
 * campo vai no `aria-label` e no placeholder.
 */
export function CampoDeBusca({
  name = "busca",
  rotulo,
  placeholder,
  defaultValue,
  value,
  aoMudar,
}: {
  name?: string;
  rotulo: string;
  placeholder: string;
  /** Busca que recarrega a pagina, dentro de um `<form>`. */
  defaultValue?: string;
  /** Busca que filtra na hora, com estado de quem chamou. */
  value?: string;
  aoMudar?: (evento: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="relative">
      <Search
        size={16}
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-tinta-suave"
      />
      <input
        type="search"
        name={name}
        aria-label={rotulo}
        placeholder={placeholder}
        defaultValue={defaultValue}
        value={value}
        onChange={aoMudar}
        className={juntar(
          ALTURA_CONTROLE,
          MOLDURA_CONTROLE,
          BORDA_NORMAL,
          "pr-3 pl-9 placeholder:text-tinta-suave/70",
        )}
      />
    </div>
  );
}

import type { ReactNode } from "react";

import { juntar } from "./controle";

/**
 * Cartao de conteudo do painel, com o titulo em caixa alta.
 *
 * Existe porque a mesma moldura aparecia em seis lugares diferentes, e ajustar
 * o raio ou a borda significava caçar classe por classe.
 */
export function Secao({
  titulo,
  acao,
  children,
  semPadding,
}: {
  titulo?: string;
  acao?: ReactNode;
  children: ReactNode;
  semPadding?: boolean;
}) {
  return (
    <section
      className={juntar(
        "rounded-card border border-borda bg-superficie",
        semPadding ? "" : "p-5",
      )}
    >
      {titulo ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold tracking-wide text-tinta-suave uppercase">
            {titulo}
          </h2>
          {acao}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Par rotulo e valor, do jeito que o painel mostra dado de pedido. */
export function Dado({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-tinta-suave uppercase">{rotulo}</dt>
      <dd className="mt-0.5 text-sm text-tinta">{valor}</dd>
    </div>
  );
}

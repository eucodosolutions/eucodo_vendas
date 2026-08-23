import Link from "next/link";
import type { ReactNode } from "react";

import { juntar } from "./controle";

const MOLDURA =
  "flex w-full items-center justify-between gap-3 rounded-card border border-borda bg-superficie px-4 py-3 text-left transition-colors hover:border-borda-forte";

/**
 * Linha clicavel de lista, do jeito que o painel mostra cliente, pedido e produto.
 *
 * Aceita `href` ou `onClick` porque as listas do sistema fazem as duas coisas:
 * cliente e pedido abrem uma pagina de detalhe, produto abre o popup de edicao
 * ali mesmo. Vira `<Link>` ou `<button>` conforme o caso, para o teclado e o
 * leitor de tela receberem o elemento certo, e nao uma div fingindo ser botao.
 */
export function CartaoDeLista({
  href,
  onClick,
  children,
}: {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  if (href) {
    return (
      <Link href={href} className={MOLDURA}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={juntar(MOLDURA, "cursor-pointer")}>
      {children}
    </button>
  );
}

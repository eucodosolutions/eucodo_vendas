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
 *
 * `acao` e para o controle que age sem abrir nada, como o interruptor que tira
 * o produto da venda. Ele fica por cima do cartao, e nao dentro: botao dentro
 * de botao nao e HTML valido, e o clique no controle viraria clique no cartao.
 */
export function CartaoDeLista({
  href,
  onClick,
  acao,
  children,
}: {
  href?: string;
  onClick?: () => void;
  acao?: ReactNode;
  children: ReactNode;
}) {
  const abertura = href ? (
    <Link href={href} className={juntar(MOLDURA, acao ? "pr-16" : null)}>
      {children}
    </Link>
  ) : (
    <button
      type="button"
      onClick={onClick}
      className={juntar(MOLDURA, "cursor-pointer", acao ? "pr-16" : null)}
    >
      {children}
    </button>
  );

  if (!acao) return abertura;

  return (
    <div className="relative">
      {abertura}
      <div className="absolute inset-y-0 right-4 flex items-center">{acao}</div>
    </div>
  );
}

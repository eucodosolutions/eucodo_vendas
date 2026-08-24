import { LayoutGrid, List } from "lucide-react";
import Link from "next/link";

import { juntar } from "@/components/ui/controle";

export type Vista = "quadro" | "lista";

/**
 * Quadro ou lista, no canto do cabecalho.
 *
 * As duas respondem perguntas diferentes e por isso convivem: o quadro mostra
 * como esta a oficina agora, a lista mostra a ordem em que as vendas
 * aconteceram — que e como se procura um pedido de semanas atras.
 *
 * So aparece a partir de `lg`, onde o quadro existe. Abaixo disso a tela ja e a
 * lista, com as abas de status por cima; um botao para trocar para o que ja
 * esta na tela so confundiria.
 */
export function AlternadorDeVista({ vista }: { vista: Vista }) {
  return (
    <div
      className="hidden rounded-lg border border-borda bg-superficie p-1 lg:inline-flex"
      aria-label="Como ver os pedidos"
    >
      <Opcao href="/pedidos" atual={vista === "quadro"} rotulo="Quadro">
        <LayoutGrid size={16} aria-hidden />
      </Opcao>
      <Opcao href="/pedidos?vista=lista" atual={vista === "lista"} rotulo="Lista">
        <List size={16} aria-hidden />
      </Opcao>
    </div>
  );
}

function Opcao({
  href,
  atual,
  rotulo,
  children,
}: {
  href: string;
  atual: boolean;
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={atual ? "page" : undefined}
      className={juntar(
        "flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
        atual ? "bg-marca-suave text-marca" : "text-tinta-suave hover:text-tinta",
      )}
    >
      {children}
      {rotulo}
    </Link>
  );
}

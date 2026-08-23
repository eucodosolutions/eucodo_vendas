import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { ALTURA_CONTROLE, juntar } from "./controle";

/** As mesmas do `Botao`: os dois sao a mesma coisa aos olhos de quem clica. */
type Variante = "primario" | "secundario" | "fantasma" | "sucesso";

const ESTILOS: Record<Variante, string> = {
  primario: "bg-marca text-white hover:bg-marca-escura",
  secundario: "bg-superficie text-tinta border border-borda-forte hover:border-tinta-suave",
  fantasma: "bg-transparent text-marca hover:bg-marca-suave",
  sucesso: "bg-sucesso text-white hover:opacity-90",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium whitespace-nowrap transition-colors";

/** Mesma aparencia do botao, para quando a acao e navegar ou baixar. */
export function LinkBotao({
  href,
  variante = "primario",
  externo,
  children,
  ...props
}: {
  href: string;
  variante?: Variante;
  externo?: boolean;
  children: ReactNode;
} & Omit<ComponentProps<"a">, "href" | "className" | "children">) {
  const classe = juntar(ALTURA_CONTROLE, BASE, ESTILOS[variante]);

  if (externo) {
    return (
      <a {...props} href={href} target="_blank" rel="noreferrer noopener" className={classe}>
        {children}
      </a>
    );
  }

  return (
    <Link {...props} href={href} className={classe}>
      {children}
    </Link>
  );
}

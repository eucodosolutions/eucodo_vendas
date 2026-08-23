"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { itemAtivo, itensDoPapel } from "./itens";
import type { PapelUsuario } from "@/types/database";

/**
 * Navegacao do celular, no rodape.
 *
 * Fica embaixo porque o painel e usado com uma mao so, no meio de uma conversa
 * de venda: o polegar alcanca o rodape, nao o topo. O `env(safe-area-inset-bottom)`
 * e o que impede os botoes de ficarem debaixo da barra do iPhone.
 */
export function BarraInferior({ papel }: { papel: PapelUsuario }) {
  const caminho = usePathname();
  const itens = itensDoPapel(papel);
  const ativo = itemAtivo(itens, caminho);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-borda bg-superficie pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="flex">
        {itens.map((item) => {
          const Icone = item.icone;
          const aceso = ativo === item.href;

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={aceso ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 transition-colors ${
                  aceso ? "text-marca" : "text-tinta-suave"
                }`}
              >
                <Icone size={20} aria-hidden />
                <span className="text-[0.6875rem] leading-none font-medium">{item.rotulo}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

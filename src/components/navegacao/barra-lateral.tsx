"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { inicioDoPapel, itemAtivo, itensDoPapel } from "./itens";
import { sair } from "@/app/(auth)/actions";
import type { PapelUsuario } from "@/types/database";

/** Navegacao do desktop. No celular quem manda e a barra de baixo. */
export function BarraLateral({
  papel,
  nome,
  conta,
}: {
  papel: PapelUsuario;
  nome: string;
  conta: string;
}) {
  const caminho = usePathname();
  const itens = itensDoPapel(papel);
  const ativo = itemAtivo(itens, caminho);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-borda bg-superficie md:flex">
      <Link href={inicioDoPapel(papel)} className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-marca text-base font-bold text-white">
          E
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold tracking-tight text-tinta">
            {conta}
          </span>
          <span className="block text-xs text-tinta-suave">Eucodo Vendas</span>
        </span>
      </Link>

      <nav className="flex-1 px-3">
        <ul className="flex flex-col gap-1">
          {itens.map((item) => {
            const Icone = item.icone;
            const aceso = ativo === item.href;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={aceso ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    aceso
                      ? "bg-marca-suave text-marca"
                      : "text-tinta-media hover:bg-papel hover:text-tinta"
                  }`}
                >
                  <Icone size={18} aria-hidden />
                  {item.rotulo}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form action={sair} className="border-t border-borda p-3">
        <p className="truncate px-2 pb-2 text-xs text-tinta-suave">{nome}</p>
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-tinta-media transition-colors hover:bg-papel hover:text-tinta"
        >
          <LogOut size={18} aria-hidden />
          Sair
        </button>
      </form>
    </aside>
  );
}

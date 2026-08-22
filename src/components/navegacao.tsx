"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { sair } from "@/app/(auth)/actions";

const ITENS = [
  { href: "/vender", rotulo: "Vender" },
  { href: "/pedidos", rotulo: "Pedidos" },
];

const ITENS_ADMIN = [{ href: "/ajustes", rotulo: "Ajustes" }];

export function Navegacao({ nome, ehAdmin }: { nome: string; ehAdmin: boolean }) {
  const caminho = usePathname();
  const itens = ehAdmin ? [...ITENS, ...ITENS_ADMIN] : ITENS;

  return (
    <header className="border-b border-borda bg-superficie">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-5 py-3">
        <Link href="/vender" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-marca text-sm font-bold text-white">
            E
          </span>
          <span className="hidden text-base font-semibold tracking-tight text-tinta sm:block">
            Eucodo Vendas
          </span>
        </Link>

        <nav className="ml-2 flex items-center gap-1">
          {itens.map((item) => {
            const ativo = caminho === item.href || caminho.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={ativo ? "page" : undefined}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  ativo ? "bg-marca-suave text-marca" : "text-tinta-media hover:bg-papel"
                }`}
              >
                {item.rotulo}
              </Link>
            );
          })}
        </nav>

        <form action={sair} className="ml-auto flex items-center gap-3">
          <span className="hidden text-sm text-tinta-suave sm:block">{nome}</span>
          <button
            type="submit"
            className="rounded-lg px-3 py-2 text-sm font-medium text-tinta-media transition-colors hover:bg-papel"
          >
            Sair
          </button>
        </form>
      </div>
    </header>
  );
}

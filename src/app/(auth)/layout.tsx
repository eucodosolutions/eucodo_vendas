import Link from "next/link";
import type { ReactNode } from "react";

export default function LayoutAutenticacao({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-marca text-base font-bold text-white">
            E
          </span>
          <span className="text-lg font-semibold tracking-tight text-tinta">Eucodo Vendas</span>
        </Link>
        <div className="rounded-card border border-borda bg-superficie p-6 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}

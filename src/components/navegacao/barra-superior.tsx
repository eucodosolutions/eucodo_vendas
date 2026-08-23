import { LogOut } from "lucide-react";

import { sair } from "@/app/(auth)/actions";

/**
 * Cabecalho do celular: so a marca, a conta e o botao de sair.
 *
 * Os links de navegacao ficam na barra de baixo. Este cabecalho existe porque
 * "sair" precisa estar em algum lugar alcancavel, e ele nao merece um dos cinco
 * espacos da barra inferior.
 */
export function BarraSuperior({ conta }: { conta: string }) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-borda bg-superficie px-5 py-3 md:hidden">
      <span className="flex size-8 items-center justify-center rounded-lg bg-marca text-sm font-bold text-white">
        E
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight text-tinta">
        {conta}
      </span>

      <form action={sair}>
        <button
          type="submit"
          aria-label="Sair"
          className="flex size-10 items-center justify-center rounded-lg text-tinta-media transition-colors hover:bg-papel hover:text-tinta"
        >
          <LogOut size={18} aria-hidden />
        </button>
      </form>
    </header>
  );
}

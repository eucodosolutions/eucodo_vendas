import type { NextRequest } from "next/server";

import { atualizarSessao } from "@/lib/supabase/sessao";

// Next 16 renomeou o antigo middleware.ts para proxy.ts.
export async function proxy(request: NextRequest) {
  return atualizarSessao(request);
}

// sw.js e manifest.webmanifest ficam de fora: sao arquivos do PWA, buscados
// pelo navegador sem sessao. Passando pelo proxy, os dois virariam redirect
// para /entrar e a instalacao do app nunca seria oferecida.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

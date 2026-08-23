import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

/** Rotas que qualquer pessoa alcanca sem sessao, inclusive o cliente final. */
const ROTAS_PUBLICAS = [
  "/entrar",
  "/criar-conta",
  "/esqueci-senha",
  "/redefinir-senha",
  "/auth",
  // Sair tem que valer tambem sem sessao: quem chega aqui ja pode ter perdido a
  // dele no caminho, e mandar essa pessoa para `/entrar?proxima=/sair` e cruel.
  "/sair",
  "/catalogo",
  "/pedido",
];

/** Rotas de sessao que um usuario logado nao deveria mais ver. */
const ROTAS_DE_ENTRADA = ["/entrar", "/criar-conta", "/esqueci-senha"];

export async function atualizarSessao(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() valida o token no servidor. getSession() le o cookie sem
  // validar, e nao serve para decidir acesso.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, searchParams } = request.nextUrl;

  // O Supabase manda o link de confirmacao para a Site URL, que e a raiz.
  // Sem este desvio o code se perde no redirect para /entrar.
  if (searchParams.has("code") && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  const ehPublica = ROTAS_PUBLICAS.some(
    (rota) => pathname === rota || pathname.startsWith(`${rota}/`),
  );

  if (!user && !ehPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.searchParams.set("proxima", pathname);
    return NextResponse.redirect(url);
  }

  // /redefinir-senha fica de fora: quem clica no link do e-mail chega aqui ja
  // com sessao e precisa ver o formulario, nao o painel.
  if (user && ROTAS_DE_ENTRADA.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/vender";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Devolver esta resposta, e nao uma nova, preserva os cookies renovados.
  return response;
}

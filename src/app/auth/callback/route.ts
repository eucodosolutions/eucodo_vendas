import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Ponto de chegada dos links que o Supabase manda por e-mail. Troca o code por
 * sessao e devolve a pessoa para onde o link pediu.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const proximaBruta = searchParams.get("proxima") ?? "/vender";
  const proxima = proximaBruta.startsWith("/") ? proximaBruta : "/vender";

  if (!code) {
    return NextResponse.redirect(`${origin}/entrar?erro=link_invalido`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/entrar?erro=link_expirado`);
  }

  return NextResponse.redirect(`${origin}${proxima}`);
}

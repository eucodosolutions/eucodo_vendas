import { NextResponse, type NextRequest } from "next/server";

import { MOTIVO_DE_ACESSO } from "@/lib/acesso";
import { createClient } from "@/lib/supabase/server";

/**
 * Derruba a sessao e devolve a pessoa para o login, com o aviso na bagagem.
 *
 * Precisa ser route handler: quando o layout do painel descobre que a conta
 * esta suspensa, ele esta no meio de uma renderizacao de servidor, onde nao da
 * para apagar cookie. Redirecionar so para `/entrar` deixava a sessao viva, e
 * ai o proxy mandava de volta para `/vender`, que mandava de volta para
 * `/entrar`: a pessoa ficava presa no meio, sem botao de sair a mao.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const supabase = await createClient();
  await supabase.auth.signOut();

  const erro = searchParams.get("erro");
  const destino = new URL("/entrar", origin);

  // So repassa codigo que a tela de login sabe traduzir: o parametro vem da
  // URL e nao vale escrever na barra de endereco o aviso que se quiser.
  // `hasOwn`, e nao `in`: o `in` acha as chaves de Object.prototype tambem, e
  // `?erro=constructor` passaria adiante um codigo que resolve para funcao.
  if (erro && Object.hasOwn(MOTIVO_DE_ACESSO, erro)) destino.searchParams.set("erro", erro);

  return NextResponse.redirect(destino);
}

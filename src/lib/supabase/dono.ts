import "server-only";

import { sessaoDoPainel } from "./painel";

/**
 * A conta de quem esta logado, e so se essa pessoa for a dona dela.
 *
 * Catalogo, configuracao, equipe e cliente sao do assinante. Vendedor vende, e
 * so. Toda action desse grupo comeca perguntando isto, entao a pergunta mora
 * num lugar so: esquecer a checagem em uma delas abriria a conta inteira.
 */
export async function contaDoDono(): Promise<string | null> {
  const sessao = await sessaoDoPainel();

  if (sessao?.perfil.papel !== "assinante" || !sessao.perfil.assinatura_id) return null;
  return sessao.perfil.assinatura_id;
}

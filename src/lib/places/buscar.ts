"use server";

import { createClient } from "@/lib/supabase/server";

export type NegocioEncontrado = {
  placeId: string;
  nome: string;
  endereco: string;
  /** O link que abre a caixa de avaliacao, ja pronto do Google. */
  linkAvaliacao: string;
};

export type ResultadoDaBusca = {
  negocios: NegocioEncontrado[];
  erro?: string;
};

/**
 * Procura o negocio no Google para o link de avaliacao vir pronto.
 *
 * A aplicacao nao conhece a chave do Google: manda o JWT de quem esta vendendo
 * e a Edge Function decide. O que volta ja e o link certo, aquele que abre o
 * formulario de avaliacao — e nao a ficha do negocio.
 */
export async function buscarNegocio(busca: string): Promise<ResultadoDaBusca> {
  const termo = busca.trim();
  if (termo.length < 3) return { negocios: [] };

  const supabase = await createClient();

  const { data, error } = await supabase.functions.invoke<ResultadoDaBusca>("places", {
    body: { busca: termo },
  });

  if (error) return { negocios: [], erro: await motivo(error) };
  if (!data) return { negocios: [], erro: PADRAO };

  return { negocios: data.negocios ?? [], erro: data.erro };
}

const PADRAO = "Não consegui buscar no Google agora.";

/**
 * Tira da falha o que a funcao tem a dizer.
 *
 * `functions.invoke` transforma qualquer resposta fora do 2xx em erro e guarda
 * a resposta original no `context`. Sem abrir esse envelope, "conta sem acesso",
 * "chave nao configurada" e "o Google recusou" chegam na tela como a mesma
 * frase — e a primeira versao disto fez exatamente isso, o que custou uma
 * investigacao inteira para descobrir de qual dos tres se tratava.
 */
async function motivo(error: unknown): Promise<string> {
  const resposta = (error as { context?: unknown }).context;
  if (!(resposta instanceof Response)) return PADRAO;

  // O terminal de quem esta desenvolvendo merece o status; a tela do vendedor,
  // so a frase.
  try {
    const corpo = (await resposta.clone().json()) as { erro?: unknown };
    console.error("places:", resposta.status, corpo);
    return typeof corpo.erro === "string" ? corpo.erro : PADRAO;
  } catch {
    console.error("places:", resposta.status, await resposta.clone().text());
    return PADRAO;
  }
}

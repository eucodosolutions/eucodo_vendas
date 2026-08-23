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

  if (error || !data) {
    return { negocios: [], erro: "Não consegui buscar no Google agora." };
  }

  return { negocios: data.negocios ?? [], erro: data.erro };
}

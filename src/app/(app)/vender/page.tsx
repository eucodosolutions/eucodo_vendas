import type { Metadata } from "next";

import { VendaRapida, type TamanhoComVariantes } from "./venda-rapida";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Venda rapida" };

export default async function PaginaVender() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("tamanhos")
    .select("codigo, rotulo, largura_mm, altura_mm, ordem, variantes (id, cor, tecnologia, preco_centavos, ativo)")
    .eq("ativo", true)
    .order("ordem")
    .returns<TamanhoComVariantes[]>();

  const tamanhos = (data ?? [])
    .map((tamanho) => ({
      ...tamanho,
      variantes: tamanho.variantes.filter((variante) => variante.ativo),
    }))
    .filter((tamanho) => tamanho.variantes.length > 0);

  if (tamanhos.length === 0) {
    return (
      <div className="rounded-card border border-borda bg-superficie p-6">
        <h1 className="text-lg font-semibold tracking-tight text-tinta">Nenhum modelo cadastrado</h1>
        <p className="mt-2 text-sm text-tinta-suave">
          Cadastre pelo menos um tamanho com preco em Ajustes para comecar a vender.
        </p>
      </div>
    );
  }

  return <VendaRapida tamanhos={tamanhos} />;
}

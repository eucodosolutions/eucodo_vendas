import type { NextRequest } from "next/server";
import { z } from "zod";

import {
  entradaDosParametros,
  LIMITES,
  nomeDoArquivo,
  type ParametrosDaArte,
} from "../parametros";
import { renderPrintJpg } from "@/lib/art/render";
import { buildDisplaySvg } from "@/lib/art/template";
import { CORES, TECNOLOGIAS } from "@/lib/catalogo";
import { sessaoDoPainel } from "@/lib/supabase/painel";

/**
 * O arquivo da bancada, rasterizado na hora e entregue direto.
 *
 * E rota, e nao server action, porque assim o botao e um `<a download>` de
 * verdade: o navegador baixa sozinho, sem blob montado no meio do caminho.
 *
 * Nada e gravado — nem pedido, nem linha no Storage. `renderPrintJpg` e a mesma
 * funcao que o fechamento usa, entao o arquivo de teste sai igual ao que iria
 * para a grafica com aquele nome e aquele link.
 */

/** `numeric` chega como texto na query; `coerce` faz a ponte e o resto confere. */
function medida(limite: { min: number; max: number }, campo: string) {
  return z.coerce
    .number()
    .min(limite.min, `${campo} precisa ser pelo menos ${limite.min}.`)
    .max(limite.max, `${campo} passa do limite de ${limite.max}.`);
}

const PARAMETROS = z.object({
  nome: z.string().max(120, "O nome do negócio é comprido demais.").default(""),
  link: z.string().max(2000, "O link é comprido demais.").default(""),
  cor: z.enum(CORES, { message: "Cor desconhecida." }),
  tec: z.enum(TECNOLOGIAS, { message: "Tecnologia desconhecida." }),
  largura: medida(LIMITES.larguraMm, "A largura"),
  altura: medida(LIMITES.alturaMm, "A altura"),
  margem: medida(LIMITES.margemMm, "A margem"),
  sangria: medida(LIMITES.sangriaMm, "A sangria"),
  dpi: medida(LIMITES.dpi, "O DPI"),
  rotulo: z.string().max(120).default(""),
  formato: z.enum(["jpg", "svg"], { message: "Formato desconhecido." }),
});

export async function GET(request: NextRequest) {
  // O proxy ja barra quem nao tem sessao, porque `/gerador` nao e rota publica.
  // Aqui confere de novo: e uma linha, e o que vem depois dela queima CPU.
  const sessao = await sessaoDoPainel();
  if (!sessao) return new Response("Entre para gerar a arte.", { status: 401 });

  const lido = PARAMETROS.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!lido.success) {
    return new Response(lido.error.issues[0]?.message ?? "Parâmetro inválido.", { status: 400 });
  }

  const { formato, largura, altura, margem, sangria, dpi, ...resto } = lido.data;
  const parametros: ParametrosDaArte = {
    ...resto,
    larguraMm: largura,
    alturaMm: altura,
    margemMm: margem,
    sangriaMm: sangria,
    dpi,
  };

  const entrada = entradaDosParametros(parametros);

  try {
    // Sem `cornerRadius`: o canto arredondado e do acrilico e so da previa. O
    // que sai para a grafica sai reto, e quem corta faz o canto na maquina.
    const corpo =
      formato === "svg"
        ? new TextEncoder().encode(buildDisplaySvg(entrada))
        : new Uint8Array(await renderPrintJpg(entrada));

    return new Response(corpo, {
      headers: {
        "Content-Type": formato === "svg" ? "image/svg+xml; charset=utf-8" : "image/jpeg",
        "Content-Disposition": `attachment; filename="${nomeDoArquivo(parametros, formato)}"`,
        // A arte muda a cada tecla digitada na bancada; guardar seria servir a
        // peca anterior para a query seguinte.
        "Cache-Control": "no-store",
      },
    });
  } catch (causa) {
    console.error("gerador: não deu para desenhar", causa);
    return new Response("Não deu para desenhar esta peça. Confira o link e as medidas.", {
      status: 422,
    });
  }
}

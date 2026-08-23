import { specDoProduto } from "./spec";
import { buildDisplaySvg } from "./template";
import type { ArtColor, ArtSpec } from "./types";
import type { Produto, ProdutoAvaliacao } from "@/types/database";

/**
 * A peca de exemplo que a vitrine mostra, uma por cor do produto.
 *
 * A arte de verdade so existe depois de o cliente dizer o nome do negocio e
 * colar o link, entao a venda mostrava no lugar dela uma caixinha com o icone
 * de QR e a sigla do tamanho. Quem vende sem o mostruario na mao nao tinha o
 * que virar para o cliente ver. Aqui quem desenha e o mesmo motor que imprime:
 * a vitrine muda junto com a arte, sem uma segunda ilustracao para manter.
 */

/**
 * O nome que vai na peca de exemplo.
 *
 * Ele mesmo diz o que a peca e — um lugar reservado para o negocio de quem esta
 * olhando — sem precisar de legenda dizendo que aquilo e so uma previa.
 */
const NEGOCIO_DE_EXEMPLO = "Seu negócio";

/**
 * O destino do QR da previa.
 *
 * Precisa ser endereco real: o cliente na frente do vendedor escaneia o que ve
 * na tela, e cair num link quebrado estraga a demonstracao. O Maps e o lugar
 * mais proximo do que o QR de verdade vai fazer.
 */
const LINK_DE_EXEMPLO = "https://maps.google.com";

export type PreviaDaArte = { cor: ArtColor; svg: string };

/**
 * O canto arredondado do acrilico, cerca de 4 mm. So a previa tem: a arte que
 * vai para a grafica sai reta, e quem corta faz o canto na maquina.
 */
export function cantoDaPrevia(spec: ArtSpec): number {
  // O desenho trabalha em decimo de milimetro, dai o fator 10.
  return spec.widthMm * 0.04 * 10;
}

type PlacaDaPrevia = Pick<
  ProdutoAvaliacao,
  "largura_mm" | "altura_mm" | "margem_seguranca_mm" | "sangria_mm" | "dpi" | "cores" | "tecnologia"
>;

/**
 * As previas de uma placa, na ordem das cores que o produto oferece.
 *
 * Sai sem sangria de proposito: a sangria e sobra para a guilhotina, e na tela
 * ela apareceria como uma tarja de cor por fora da peca.
 */
export function previasDaPlaca(
  produto: Pick<Produto, "nome">,
  placa: PlacaDaPrevia,
): PreviaDaArte[] {
  const spec: ArtSpec = { ...specDoProduto(produto, placa), bleedMm: 0 };

  return placa.cores.map((cor) => ({
    cor,
    svg: buildDisplaySvg(
      {
        spec,
        color: cor,
        tech: placa.tecnologia,
        businessName: NEGOCIO_DE_EXEMPLO,
        reviewUrl: LINK_DE_EXEMPLO,
      },
      { cornerRadius: cantoDaPrevia(spec), fontFamily: "inherit" },
    ),
  }));
}

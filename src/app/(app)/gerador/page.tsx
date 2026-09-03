import type { Metadata } from "next";

import { GeradorDeArte } from "./gerador-de-arte";
import type { ModeloDoGerador } from "./modelo";
import type { NegocioCadastrado } from "@/components/ui/busca-de-negocio";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { detalheDaPlaca } from "@/lib/catalogo";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Gerador de arte" };

/** O detalhe da placa volta nulo quando o produto foi cadastrado sem medidas. */
type LinhaDoCatalogo = Omit<ModeloDoGerador, "produto_avaliacao"> & {
  produto_avaliacao: ModeloDoGerador["produto_avaliacao"] | null;
};

/**
 * A bancada de teste da arte.
 *
 * O catalogo vem so para dar o ponto de partida — medidas e tecnologia de uma
 * placa de verdade. Dai para frente e tudo tela: nada aqui abre pedido, cadastra
 * cliente, sobe arquivo para o Storage ou manda mensagem.
 */
export default async function PaginaGerador() {
  const supabase = await createClient();

  const [{ data: catalogo }, { data: negocios }] = await Promise.all([
    supabase
      .from("produtos")
      .select(
        `id, nome, ${detalheDaPlaca("largura_mm, altura_mm, margem_seguranca_mm, sangria_mm, dpi, cores, tecnologia")}`,
      )
      .eq("tipo", "avaliacao")
      .eq("ativo", true)
      .order("ordem")
      .order("nome")
      .returns<LinhaDoCatalogo[]>(),
    // A agenda de negocios, como na venda: escolher o lugar da lista e a unica
    // forma de saber para onde o QR aponta sem precisar conferir link nenhum.
    supabase
      .from("negocios")
      .select("id, nome, link_avaliacao, google_place_id, endereco")
      .order("criado_em", { ascending: false })
      .limit(300)
      .returns<NegocioCadastrado[]>(),
  ]);

  // Placa sem medida nao desenha. Cai fora da lista em vez de quebrar a tela, do
  // mesmo jeito que a vitrine de `/vender` faz.
  const modelos = (catalogo ?? []).filter(
    (produto): produto is ModeloDoGerador => produto.produto_avaliacao !== null,
  );

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoDePagina
        titulo="Gerador de arte"
        descricao="Monte uma placa com qualquer nome e link para conferir o desenho e baixar o arquivo. Não abre pedido nem manda nada para o cliente."
      />

      <GeradorDeArte modelos={modelos} negocios={negocios ?? []} />
    </div>
  );
}

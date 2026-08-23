import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ListaDeProdutos } from "./lista-de-produtos";
import type { ProdutoEditavel } from "./modal-produto";
import { sessaoDoPainel } from "@/lib/supabase/painel";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Produtos" };

type ProdutoDoBanco = Omit<ProdutoEditavel, "foto_url"> & { foto_path: string | null };

export default async function PaginaProdutos() {
  const sessao = await sessaoDoPainel();

  // Vendedor nao mexe no catalogo: e aqui que mora o preco e a comissao.
  if (sessao?.perfil.papel !== "assinante") redirect("/vender");

  const supabase = await createClient();

  const { data: produtos } = await supabase
    .from("produtos")
    .select(
      "id, tipo, codigo, nome, descricao, foto_path, preco_centavos, comissao_percentual, prazo_entrega_dias, ativo, produto_avaliacao (largura_mm, altura_mm, margem_seguranca_mm, sangria_mm, dpi, cores, tecnologias)",
    )
    .order("ordem")
    .order("nome")
    .returns<ProdutoDoBanco[]>();

  // O bucket e publico, entao a URL e montada uma vez aqui e nao expira.
  const lista: ProdutoEditavel[] = (produtos ?? []).map((produto) => ({
    ...produto,
    foto_url: produto.foto_path
      ? supabase.storage.from("produtos").getPublicUrl(produto.foto_path).data.publicUrl
      : null,
  }));

  return <ListaDeProdutos produtos={lista} />;
}

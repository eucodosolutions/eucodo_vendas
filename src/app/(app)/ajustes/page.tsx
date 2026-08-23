import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FormularioConfiguracoes } from "./formulario-configuracoes";
import { FormularioProduto, type ProdutoEditavel } from "./formulario-produto";
import { ROTULO_TIPO_PRODUTO } from "@/lib/formato";
import { sessaoDoPainel } from "@/lib/supabase/painel";
import { createClient } from "@/lib/supabase/server";
import type { Configuracoes } from "@/types/database";

export const metadata: Metadata = { title: "Ajustes" };

type ProdutoDoBanco = Omit<ProdutoEditavel, "foto_url"> & { foto_path: string | null };

export default async function PaginaAjustes() {
  const sessao = await sessaoDoPainel();

  // Vendedor nao entra em Ajustes: e aqui que mora o PIX e o preco.
  if (sessao?.perfil.papel !== "assinante") redirect("/vender");

  const supabase = await createClient();

  const [{ data: configuracoes }, { data: produtos }] = await Promise.all([
    supabase
      .from("configuracoes")
      .select("*")
      .eq("assinatura_id", sessao.perfil.assinatura_id!)
      .single<Configuracoes>(),
    supabase
      .from("produtos")
      .select(
        "id, tipo, codigo, nome, descricao, foto_path, preco_centavos, comissao_percentual, prazo_entrega_dias, ativo, produto_avaliacao (largura_mm, altura_mm, margem_seguranca_mm, sangria_mm, dpi, cores, tecnologias)",
      )
      .order("ordem")
      .order("nome")
      .returns<ProdutoDoBanco[]>(),
  ]);

  // O bucket e publico, entao a URL e montada uma vez aqui e nao expira.
  const lista: ProdutoEditavel[] = (produtos ?? []).map((produto) => ({
    ...produto,
    foto_url: produto.foto_path
      ? supabase.storage.from("produtos").getPublicUrl(produto.foto_path).data.publicUrl
      : null,
  }));

  const prazoPadrao = configuracoes?.prazo_producao_dias ?? 3;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-tinta">Ajustes</h1>
        <p className="mt-1 text-sm text-tinta-suave">
          Os produtos, os preços e o pagamento da conta {sessao.conta?.nome}.
        </p>
      </header>

      {configuracoes ? <FormularioConfiguracoes configuracoes={configuracoes} /> : null}

      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-tinta">Seus produtos</h2>
        <p className="-mt-2 text-sm text-tinta-suave">
          {ROTULO_TIPO_PRODUTO.avaliacao} vira arte sozinha: o desenho é calculado por proporção da
          largura útil, então qualquer formato de acrílico funciona. {ROTULO_TIPO_PRODUTO.padrao} é
          para tudo o mais que você vende.
        </p>

        {lista.map((produto) => (
          <FormularioProduto key={produto.id} produto={produto} prazoPadrao={prazoPadrao} />
        ))}

        <FormularioProduto prazoPadrao={prazoPadrao} />
      </div>
    </div>
  );
}

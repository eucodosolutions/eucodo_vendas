import type { Metadata } from "next";

import type { ClienteDaLista } from "./escolher-cliente";
import { VendaRapida, type ProdutoDaVenda } from "./venda-rapida";
import { LinkBotao } from "@/components/ui/link-botao";
import { Secao } from "@/components/ui/secao";
import { sessaoDoPainel } from "@/lib/supabase/painel";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Venda rapida" };

type ProdutoDoBanco = Omit<ProdutoDaVenda, "foto_url"> & { foto_path: string | null };

export default async function PaginaVender() {
  const supabase = await createClient();
  const sessao = await sessaoDoPainel();

  const [{ data: catalogo }, { data: clientes }] = await Promise.all([
    supabase
      .from("produtos")
      .select(
        "id, tipo, codigo, nome, descricao, foto_path, preco_centavos, prazo_entrega_dias, produto_avaliacao (largura_mm, altura_mm, cores, tecnologias)",
      )
      .eq("ativo", true)
      .order("ordem")
      .order("nome")
      .returns<ProdutoDoBanco[]>(),
    // A lista inteira vem de uma vez e o filtro roda no navegador: com o cliente
    // na frente, buscar no servidor a cada letra custaria mais que vale.
    supabase
      .from("clientes")
      .select("id, nome, whatsapp")
      .order("nome")
      .limit(300)
      .returns<ClienteDaLista[]>(),
  ]);

  // Placa sem medida nao gera arte: fica fora da venda ate o dono completar o
  // cadastro, em vez de quebrar no fechamento do pedido.
  const produtos: ProdutoDaVenda[] = (catalogo ?? [])
    .filter((produto) => produto.tipo === "padrao" || produto.produto_avaliacao !== null)
    .map((produto) => ({
      ...produto,
      foto_url: produto.foto_path
        ? supabase.storage.from("produtos").getPublicUrl(produto.foto_path).data.publicUrl
        : null,
    }));

  if (produtos.length === 0) {
    const ehAssinante = sessao?.perfil.papel === "assinante";

    return (
      <Secao>
        <h1 className="text-lg font-semibold tracking-tight text-tinta">Nenhum produto à venda</h1>
        <p className="mt-2 text-sm text-tinta-suave">
          {ehAssinante
            ? "Cadastre pelo menos um produto em Ajustes para começar a vender."
            : "Peça ao dono da conta para cadastrar os produtos em Ajustes."}
        </p>
        {ehAssinante ? (
          <div className="mt-4">
            <LinkBotao href="/ajustes">Ir para Ajustes</LinkBotao>
          </div>
        ) : null}
      </Secao>
    );
  }

  return <VendaRapida produtos={produtos} clientes={clientes ?? []} />;
}

import type { Metadata } from "next";

import type { ClienteDaLista } from "./escolher-cliente";
import { VendaRapida, type ProdutoDaVenda } from "./venda-rapida";
import { LinkBotao } from "@/components/ui/link-botao";
import { Secao } from "@/components/ui/secao";
import { previasDaPlaca } from "@/lib/art/vitrine";
import { detalheDaPlaca } from "@/lib/catalogo";
import { sessaoDoPainel } from "@/lib/supabase/painel";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Venda rapida" };

type ProdutoDoBanco = Omit<ProdutoDaVenda, "foto_url" | "previas"> & { foto_path: string | null };

export default async function PaginaVender() {
  const supabase = await createClient();
  const sessao = await sessaoDoPainel();

  const [{ data: catalogo }, { data: clientes }, { data: pix }] = await Promise.all([
    supabase
      .from("produtos")
      .select(
        `id, tipo, nome, descricao, foto_path, preco_centavos, prazo_entrega_dias, ${detalheDaPlaca("largura_mm, altura_mm, margem_seguranca_mm, sangria_mm, dpi, cores, tecnologia")}`,
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
    // So a existencia da chave interessa aqui: e ela que decide se o fechamento
    // pode prometer o PIX copia e cola. Vai pela funcao, e nao pela tabela,
    // porque `configuracoes` so abre para o assinante e esta tela e do vendedor
    // tambem. O codigo em si e montado no servidor, no fechamento.
    supabase.rpc("pix_da_conta").maybeSingle(),
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
      // A peca de exemplo e desenhada aqui, no servidor: o motor de arte usa o
      // gerador de QR, que nao precisa ir para o navegador so para a vitrine.
      previas: produto.produto_avaliacao
        ? previasDaPlaca(produto, produto.produto_avaliacao)
        : [],
    }));

  if (produtos.length === 0) {
    const ehAssinante = sessao?.perfil.papel === "assinante";

    return (
      <Secao>
        <h1 className="text-lg font-semibold tracking-tight text-tinta">Nenhum produto à venda</h1>
        <p className="mt-2 text-sm text-tinta-suave">
          {ehAssinante
            ? "Cadastre pelo menos um produto em Produtos para começar a vender."
            : "Peça ao dono da conta para cadastrar os produtos."}
        </p>
        {ehAssinante ? (
          <div className="mt-4">
            <LinkBotao href="/produtos">Ir para Produtos</LinkBotao>
          </div>
        ) : null}
      </Secao>
    );
  }

  return (
    <VendaRapida
      produtos={produtos}
      clientes={clientes ?? []}
      pixConfigurado={Boolean(pix?.pix_chave)}
    />
  );
}

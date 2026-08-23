"use client";

import { ShoppingCart } from "lucide-react";
import { useState, useActionState } from "react";

import { criarPedido, type EstadoVenda, type PedidoDoCarrinho } from "./actions";
import { CartaoDeProduto } from "./cartao-de-produto";
import type { ClienteDaLista } from "./escolher-cliente";
import { GavetaDoCarrinho } from "./gaveta-do-carrinho";
import { ModalFechamento } from "./modal-fechamento";
import { ModalItem } from "./modal-item";
import { avisar, useAviso } from "@/components/ui/avisos";
import { useCarrinho } from "@/lib/carrinho/usar-carrinho";
import { pecasDoCarrinho, totalDoCarrinho } from "@/lib/carrinho/carrinho";
import { moeda } from "@/lib/formato";
import type { CorArte, TecnologiaArte, TipoProduto } from "@/types/database";

export type ProdutoDaVenda = {
  id: string;
  tipo: TipoProduto;
  nome: string;
  descricao: string | null;
  foto_url: string | null;
  preco_centavos: number;
  prazo_entrega_dias: number;
  produto_avaliacao: {
    largura_mm: number;
    altura_mm: number;
    cores: CorArte[];
    tecnologia: TecnologiaArte;
  } | null;
};

/**
 * A vitrine: os produtos em grade, e o carrinho numa gaveta.
 *
 * Antes esta tela era um formulario so, com todos os campos de todos os passos
 * abertos ao mesmo tempo. Funcionava com um produto no catalogo e virou uma
 * parede de campos com quatro. Agora cada passo aparece quando chega a vez
 * dele: escolher na grade, completar no popup, conferir na gaveta, fechar.
 */
export function VendaRapida({
  produtos,
  clientes,
  pixConfigurado,
}: {
  produtos: ProdutoDaVenda[];
  clientes: ClienteDaLista[];
  pixConfigurado: boolean;
}) {
  const [estado, fechar, fechando] = useActionState<EstadoVenda, PedidoDoCarrinho>(criarPedido, {});
  useAviso(estado);

  const carrinho = useCarrinho();

  const [produtoAberto, setProdutoAberto] = useState<ProdutoDaVenda | null>(null);
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const [fechamentoAberto, setFechamentoAberto] = useState(false);

  const pecas = pecasDoCarrinho(carrinho.itens);
  const temItens = pecas > 0;

  function adicionar(item: Parameters<typeof carrinho.adicionar>[0]) {
    carrinho.adicionar(item);
    avisar.sucesso("Item no carrinho.");
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-tinta">Vender</h1>
          <p className="mt-1 text-sm text-tinta-suave">
            Escolha o produto, complete o item e feche o pedido.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {produtos.map((produto) => (
          <CartaoDeProduto
            key={produto.id}
            produto={produto}
            aoAdicionar={() => setProdutoAberto(produto)}
          />
        ))}
      </div>

      {/* Barra do carrinho presa no rodape, e nao um botao redondo solto: ela
          mostra o total, que e o que o vendedor confere antes de fechar. Some
          quando o carrinho esta vazio para nao cobrir a vitrine a toa. */}
      {temItens ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center p-4 pb-24 md:pb-4">
          <button
            type="button"
            onClick={() => setGavetaAberta(true)}
            className="pointer-events-auto flex items-center gap-3 rounded-full bg-marca py-3 pr-4 pl-5 text-white shadow-lg transition-colors hover:bg-marca-escura"
          >
            <ShoppingCart size={18} aria-hidden />
            <span className="text-sm font-medium">
              {pecas} {pecas === 1 ? "peça" : "peças"}
            </span>
            <span className="text-sm font-semibold tabular-nums">
              {moeda(totalDoCarrinho(carrinho.itens))}
            </span>
            <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-medium">
              Ver carrinho
            </span>
          </button>
        </div>
      ) : null}

      <ModalItem
        produto={produtoAberto}
        aoFechar={() => setProdutoAberto(null)}
        aoAdicionar={adicionar}
      />

      <GavetaDoCarrinho
        aberta={gavetaAberta}
        aoFechar={() => setGavetaAberta(false)}
        itens={carrinho.itens}
        aoRemover={carrinho.remover}
        aoMudarQuantidade={carrinho.mudarQuantidade}
        aoLimpar={carrinho.limpar}
        aoFinalizar={() => setFechamentoAberto(true)}
      />

      <ModalFechamento
        aberto={fechamentoAberto}
        aoFechar={() => setFechamentoAberto(false)}
        itens={carrinho.itens}
        clientes={clientes}
        pixConfigurado={pixConfigurado}
        fechando={fechando}
        aoConfirmar={({ cliente, forma, momento, observacoes }) =>
          fechar({
            clienteId: cliente.id,
            forma,
            momento,
            observacoes: observacoes || undefined,
            itens: carrinho.itens.map((item) => ({
              produtoId: item.produtoId,
              quantidade: item.quantidade,
              cor: item.cor,
              nomeNegocio: item.nomeNegocio,
              linkAvaliacao: item.linkAvaliacao,
              placeId: item.placeId,
            })),
          })
        }
      />
    </div>
  );
}

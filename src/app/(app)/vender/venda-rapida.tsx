"use client";

import { useEffect, useMemo, useState, useActionState } from "react";

import { criarPedido, type EstadoVenda, type PedidoDoCarrinho } from "./actions";
import { BotaoDoCarrinho } from "./botao-do-carrinho";
import { CartaoDeProduto } from "./cartao-de-produto";
import type { ClienteDaLista } from "./escolher-cliente";
import { GavetaDoCarrinho } from "./gaveta-do-carrinho";
import { ModalFechamento } from "./modal-fechamento";
import { ModalItem } from "./modal-item";
import { avisar, useAviso } from "@/components/ui/avisos";
import type { NegocioCadastrado } from "@/components/ui/busca-de-negocio";
import type { PreviaDaArte } from "@/lib/art/vitrine";
import { fecharCarrinho, useCarrinhoAberto } from "@/lib/carrinho/gaveta";
import { useCarrinho } from "@/lib/carrinho/usar-carrinho";
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
    margem_seguranca_mm: number;
    sangria_mm: number;
    dpi: number;
    cores: CorArte[];
    tecnologia: TecnologiaArte;
  } | null;
  /** A peca desenhada, uma por cor. Vazia no produto que nao e placa. */
  previas: PreviaDaArte[];
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
  negocios,
  pixConfigurado,
}: {
  produtos: ProdutoDaVenda[];
  clientes: ClienteDaLista[];
  negocios: NegocioCadastrado[];
  pixConfigurado: boolean;
}) {
  const [estado, fechar, fechando] = useActionState<EstadoVenda, PedidoDoCarrinho>(criarPedido, {});
  useAviso(estado);

  // O botao do fechamento nao pode depender so do `fechando`.
  //
  // Fechar um pedido leva segundos de verdade: o servidor grava os itens,
  // desenha a arte de cada placa, monta o PIX e ainda chama o WhatsApp. Depois
  // disso a acao termina com `redirect`, e a navegacao ate a tela do pedido e
  // outro tempo, ja fora da acao — o `fechando` cai ali no meio e devolve o
  // botao inteiro, com o popup ainda aberto e nada tendo mudado na tela. Quem
  // esta vendendo le isso como clique perdido e aperta de novo, que e pedido
  // dobrado.
  //
  // O que fica guardado e o `estado` de quando o clique aconteceu, e nao um
  // booleano: os dois desfechos possiveis se leem dele sozinhos. O erro devolve
  // um objeto novo do `useActionState`, e o botao se solta; o sucesso nunca
  // devolve nada, porque termina em `redirect`, entao a roda continua girando
  // ate a tela do pedido aparecer — que e exatamente o que faltava.
  const [estadoDoClique, setEstadoDoClique] = useState<EstadoVenda | null>(null);
  const enviando = estadoDoClique !== null && estadoDoClique === estado;

  const carrinho = useCarrinho();

  // O popup abre com o produto e com a cor que estava na vitrine: quem virou a
  // tela para o cliente escolher a arte nao deveria ter que escolher de novo.
  const [itemAberto, setItemAberto] = useState<{
    produto: ProdutoDaVenda;
    cor: CorArte | null;
  } | null>(null);
  const [fechamentoAberto, setFechamentoAberto] = useState(false);

  // O negocio cadastrado no popup do item nao existe na lista que veio do
  // servidor ate a proxima visita a esta tela. Sem isto, a segunda placa do
  // mesmo negocio, no mesmo carrinho, nao o encontraria em "Meus negocios".
  const [novosNegocios, setNovosNegocios] = useState<NegocioCadastrado[]>([]);
  const agenda = useMemo(() => [...novosNegocios, ...negocios], [novosNegocios, negocios]);

  // A gaveta e aberta de dois lugares: o botao do cabecalho, no computador, e o
  // botao redondo da barra de baixo, no celular, que vive fora desta tela. Por
  // isso o estado dela mora num store, e nao aqui. A limpeza na saida evita
  // reencontrar a gaveta aberta na proxima visita a tela de venda.
  const gavetaAberta = useCarrinhoAberto();
  useEffect(() => fecharCarrinho, []);

  function adicionar(item: Parameters<typeof carrinho.adicionar>[0]) {
    carrinho.adicionar(item);
    avisar.sucesso("Item no carrinho.");
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Preso no topo no computador: a vitrine rola, o carrinho fica. O fundo
          e o da pagina, e as margens negativas cobrem o respiro lateral do
          painel, senao os cartoes apareceriam passando pelas beiradas. */}
      <header className="flex flex-wrap items-center justify-between gap-3 md:sticky md:top-0 md:z-20 md:-mx-5 md:-mt-2 md:bg-papel md:px-5 md:py-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-tinta">Vender</h1>
          <p className="mt-1 text-sm text-tinta-suave">
            Escolha o produto, complete o item e feche o pedido.
          </p>
        </div>

        <BotaoDoCarrinho />
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {produtos.map((produto) => (
          <CartaoDeProduto
            key={produto.id}
            produto={produto}
            aoAdicionar={(cor) => setItemAberto({ produto, cor })}
          />
        ))}
      </div>

      <ModalItem
        produto={itemAberto?.produto ?? null}
        cor={itemAberto?.cor ?? null}
        negocios={agenda}
        aoFechar={() => setItemAberto(null)}
        aoAdicionar={adicionar}
        aoCadastrarNegocio={(negocio) =>
          setNovosNegocios((atuais) => [negocio, ...atuais])
        }
      />

      <GavetaDoCarrinho
        aberta={gavetaAberta}
        aoFechar={fecharCarrinho}
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
        fechando={fechando || enviando}
        aoConfirmar={({ cliente, forma, momento, avisarCliente, observacoes }) => {
          setEstadoDoClique(estado);
          fechar({
            clienteId: cliente.id,
            forma,
            momento,
            avisarCliente,
            observacoes: observacoes || undefined,
            itens: carrinho.itens.map((item) => ({
              produtoId: item.produtoId,
              quantidade: item.quantidade,
              cor: item.cor,
              negocioId: item.negocioId,
              nomeNegocio: item.nomeNegocio,
              linkAvaliacao: item.linkAvaliacao,
              placeId: item.placeId,
            })),
          });
        }}
      />
    </div>
  );
}

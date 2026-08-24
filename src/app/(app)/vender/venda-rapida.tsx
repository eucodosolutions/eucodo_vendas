"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  abrirPedido,
  cobrarEAvisar,
  desenharArtes,
  type PedidoAberto,
  type PedidoDoCarrinho,
} from "./actions";
import { BotaoDoCarrinho } from "./botao-do-carrinho";
import { CartaoDeProduto } from "./cartao-de-produto";
import type { ClienteDaLista } from "./escolher-cliente";
import { GavetaDoCarrinho } from "./gaveta-do-carrinho";
import { ModalFechamento, type ProgressoDoFechamento } from "./modal-fechamento";
import { ModalItem } from "./modal-item";
import { avisar } from "@/components/ui/avisos";
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
  const router = useRouter();

  // O progresso e o estado do fechamento inteiro: nulo antes do clique, e do
  // clique em diante o passo que o servidor acabou de responder. E ele que
  // trava o botao, e ele nunca volta a ser nulo quando da certo — a navegacao
  // ate a tela do pedido corre depois do ultimo passo, e soltar o botao ali no
  // meio devolveria o popup inteiro com nada tendo mudado na tela. Quem esta
  // vendendo le isso como clique perdido e aperta de novo, que e pedido dobrado.
  const [progresso, setProgresso] = useState<ProgressoDoFechamento | null>(null);

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

  /**
   * O fechamento, passo a passo, com a tela contando junto.
   *
   * A ordem e obrigatoria: sem pedido gravado nao ha item para desenhar, e sem
   * os itens somados pelo gatilho o PIX sairia com o total zerado. O que muda
   * em relacao a chamada unica de antes e que cada passo responde, e o popup
   * mostra em qual esta porque o servidor acabou de dizer — nada aqui anda no
   * relogio.
   *
   * Passado o primeiro passo, o pedido existe, e dai em diante nada mais
   * cancela a venda. Arte que nao saiu e mensagem que nao foi viram aviso, e o
   * vendedor cai na tela do pedido, que e onde moram os botoes de refazer as
   * duas. Ficar preso no popup com o pedido ja gravado seria o pior desfecho:
   * ele fecharia o mesmo pedido de novo.
   */
  async function fecharPedido(dados: PedidoDoCarrinho) {
    // A conta das placas sai do carrinho, e nao da resposta do primeiro passo,
    // so para a lista de passos ja nascer com o tamanho certo. E a mesma conta
    // que o servidor faz — uma arte por linha, independente da quantidade —,
    // entao a linha do desenho nao brota no meio do caminho.
    const placasNoCarrinho = dados.itens.filter(
      (item) => produtos.find((produto) => produto.id === item.produtoId)?.tipo === "avaliacao",
    ).length;

    setProgresso({ etapa: "gravando", placas: placasNoCarrinho, feitas: 0 });

    let pedido: PedidoAberto | null = null;

    try {
      const abertura = await abrirPedido(dados);

      if (!abertura.pedido) {
        setProgresso(null);
        avisar.erro(abertura.erro);
        return;
      }

      pedido = abertura.pedido;
      const { pedidoId, codigo, placas } = abertura.pedido;

      // Uma placa por chamada: o contador da tela so anda quando a arte daquela
      // linha esta gravada, entao "2 de 3" quer dizer duas placas prontas.
      let semArte = 0;

      for (const [indice, ordem] of placas.entries()) {
        setProgresso({
          etapa: "artes",
          codigo,
          placas: placas.length,
          feitas: indice,
        });

        const arte = await desenharArtes(pedidoId, ordem);

        // `total` zerado e a placa que ja tinha arquivo, e nao uma falha: o
        // passo nao teve o que fazer. So conta como faltando o que entrou no
        // desenho e nao saiu de la gravado.
        if (arte.total > 0 && arte.feitas === 0) semArte += 1;
      }

      const desenhadas = { codigo, placas: placas.length, feitas: placas.length };

      setProgresso({ etapa: "cobranca", ...desenhadas });
      const { envio } = await cobrarEAvisar({
        pedidoId,
        avisarCliente: dados.avisarCliente,
      });

      // Sai antes de navegar, e nao na tela do pedido: la o aviso de chegada ja
      // fala da mensagem, e a arte que faltou e outro assunto. O toast atravessa
      // a navegacao, entao os dois chegam juntos e cada um diz a sua coisa.
      if (semArte > 0) {
        avisar.atencao(
          semArte === placas.length
            ? "O pedido está fechado, mas a arte não saiu. Use Gerar as artes na tela do pedido."
            : `O pedido está fechado, mas ${semArte} ${semArte === 1 ? "arte não saiu" : "artes não saíram"}. Use Gerar as artes na tela do pedido.`,
        );
      }

      setProgresso({ etapa: "abrindo", ...desenhadas });
      router.push(`/pedidos/${pedidoId}?novo=1&envio=${envio}`);
    } catch (erro) {
      console.error("Falha no fechamento do pedido", erro);

      // Nada gravado: o carrinho continua de pe e o botao volta para o vendedor
      // tentar de novo, que e o unico caminho que nao perde a venda.
      if (!pedido) {
        setProgresso(null);
        avisar.erro("Não consegui fechar o pedido. Confira a conexão e tente de novo.");
        return;
      }

      avisar.atencao(
        `Pedido ${pedido.codigo} aberto, mas o fechamento parou no meio. Confira a arte e a mensagem na tela do pedido.`,
      );
      router.push(`/pedidos/${pedido.pedidoId}?novo=1&envio=nao`);
    }
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
        progresso={progresso}
        aoConfirmar={({ cliente, forma, momento, avisarCliente, observacoes }) => {
          void fecharPedido({
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

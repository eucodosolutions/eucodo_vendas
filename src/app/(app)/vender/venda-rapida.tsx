"use client";

import { ShoppingCart } from "lucide-react";
import { useMemo, useRef, useState, useActionState } from "react";

import { criarPedido, type EstadoVenda, type PedidoDoCarrinho } from "./actions";
import { Carrinho } from "./carrinho";
import { EscolherCliente, type ClienteDaLista } from "./escolher-cliente";
import { avisar, useAviso } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { Escolha } from "@/components/ui/escolha";
import { Secao } from "@/components/ui/secao";
import { useCarrinho } from "@/lib/carrinho/usar-carrinho";
import { moeda, ROTULO_COR, ROTULO_TECNOLOGIA } from "@/lib/formato";
import type { CorArte, TecnologiaArte, TipoProduto } from "@/types/database";

export type ProdutoDaVenda = {
  id: string;
  tipo: TipoProduto;
  codigo: string;
  nome: string;
  descricao: string | null;
  foto_url: string | null;
  preco_centavos: number;
  prazo_entrega_dias: number;
  produto_avaliacao: {
    largura_mm: number;
    altura_mm: number;
    cores: CorArte[];
    tecnologias: TecnologiaArte[];
  } | null;
};

export function VendaRapida({
  produtos,
  clientes,
}: {
  produtos: ProdutoDaVenda[];
  clientes: ClienteDaLista[];
}) {
  const [estado, fechar, fechando] = useActionState<EstadoVenda, PedidoDoCarrinho>(
    criarPedido,
    {},
  );
  useAviso(estado);

  const carrinho = useCarrinho();

  const [produtoId, setProdutoId] = useState(produtos[0].id);
  const [cor, setCor] = useState<CorArte | null>(null);
  const [tecnologia, setTecnologia] = useState<TecnologiaArte | null>(null);
  const [quantidade, setQuantidade] = useState(1);
  const [nomeNegocio, setNomeNegocio] = useState("");
  const [linkAvaliacao, setLinkAvaliacao] = useState("");
  const [cliente, setCliente] = useState<ClienteDaLista | null>(null);
  const [observacoes, setObservacoes] = useState("");

  const campoDoNegocio = useRef<HTMLInputElement>(null);

  const produto = produtos.find((item) => item.id === produtoId) ?? produtos[0];
  const placa = produto.produto_avaliacao;

  // A escolha do cliente so vale enquanto o produto oferecer aquela opcao. Sem
  // isso, trocar de produto deixaria uma cor selecionada que ele nao vende.
  const corEscolhida = useMemo(
    () => (placa ? (cor && placa.cores.includes(cor) ? cor : placa.cores[0]) : null),
    [placa, cor],
  );

  const tecnologiaEscolhida = useMemo(
    () =>
      placa
        ? tecnologia && placa.tecnologias.includes(tecnologia)
          ? tecnologia
          : placa.tecnologias[0]
        : null,
    [placa, tecnologia],
  );

  function adicionar() {
    if (placa) {
      if (nomeNegocio.trim().length < 2) {
        avisar.atencao("Digite o nome do negócio que vai impresso nesta placa.");
        campoDoNegocio.current?.focus();
        return;
      }

      if (!linkAvaliacao.trim()) {
        avisar.atencao("Cole o link de avaliação do Google deste negócio.");
        return;
      }
    }

    carrinho.adicionar({
      produtoId: produto.id,
      tipo: produto.tipo,
      produtoCodigo: produto.codigo,
      produtoNome: produto.nome,
      precoUnitarioCentavos: produto.preco_centavos,
      quantidade,
      cor: corEscolhida ?? undefined,
      tecnologia: tecnologiaEscolhida ?? undefined,
      nomeNegocio: placa ? nomeNegocio.trim() : undefined,
      linkAvaliacao: placa ? linkAvaliacao.trim() : undefined,
    });

    // Limpa so o que muda de peca para peca. Produto, cor e tecnologia ficam,
    // porque o caso comum e o mesmo modelo para duas empresas.
    setNomeNegocio("");
    setLinkAvaliacao("");
    setQuantidade(1);
    if (placa) campoDoNegocio.current?.focus();

    avisar.sucesso("Item no carrinho. Adicione outro ou feche o pedido.");
  }

  function fecharPedido() {
    if (!cliente) {
      avisar.atencao("Escolha para quem é este pedido.");
      return;
    }

    fechar({
      clienteId: cliente.id,
      observacoes: observacoes.trim() || undefined,
      itens: carrinho.itens.map((item) => ({
        produtoId: item.produtoId,
        quantidade: item.quantidade,
        cor: item.cor,
        tecnologia: item.tecnologia,
        nomeNegocio: item.nomeNegocio,
        linkAvaliacao: item.linkAvaliacao,
        placeId: item.placeId,
      })),
    });
  }

  const temItens = carrinho.itens.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-tinta">Venda rápida</h1>
        <p className="mt-1 text-sm text-tinta-suave">
          Monte o carrinho, escolha o cliente e feche o pedido.
        </p>
      </header>

      {/* Este bloco e feito para ser virado para o cliente ver. */}
      <Secao>
        <div className="flex flex-col gap-5">
          <Escolha
            titulo="Produto"
            opcoes={produtos.map((item) => ({
              valor: item.id,
              rotulo: item.nome,
              detalhe: moeda(item.preco_centavos),
            }))}
            selecionado={produto.id}
            aoSelecionar={setProdutoId}
          />

          {/* Eixo de uma opcao so nao e escolha: vira ruido na frente do cliente. */}
          {placa && placa.tecnologias.length > 1 ? (
            <Escolha
              titulo="Tecnologia"
              opcoes={placa.tecnologias.map((valor) => ({
                valor,
                rotulo: valor === "qr_nfc" ? "QR + aproximação" : "Só QR code",
                detalhe: valor === "qr_nfc" ? "Escaneia ou aproxima" : "Escaneia a câmera",
              }))}
              selecionado={tecnologiaEscolhida!}
              aoSelecionar={setTecnologia}
            />
          ) : null}

          {placa && placa.cores.length > 1 ? (
            <Escolha
              titulo="Arte"
              opcoes={placa.cores.map((valor) => ({
                valor,
                rotulo: ROTULO_COR[valor],
                detalhe: valor === "branco" ? "Fundo claro" : "Fundo escuro",
              }))}
              selecionado={corEscolhida!}
              aoSelecionar={setCor}
            />
          ) : null}

          {!placa ? <Vitrine produto={produto} /> : null}
        </div>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-borda pt-5">
          <div>
            <span className="text-xs font-medium tracking-wide text-tinta-suave uppercase">
              {[
                produto.nome,
                corEscolhida ? ROTULO_COR[corEscolhida].toLowerCase() : null,
                tecnologiaEscolhida ? ROTULO_TECNOLOGIA[tecnologiaEscolhida].toLowerCase() : null,
              ]
                .filter(Boolean)
                .join(", ")}
            </span>
            <p className="mt-1 text-4xl font-semibold tracking-tight text-tinta">
              {moeda(produto.preco_centavos)}
            </p>
            <p className="mt-1 text-sm text-tinta-suave">
              Entrega em {produto.prazo_entrega_dias}{" "}
              {produto.prazo_entrega_dias === 1 ? "dia" : "dias"}
            </p>
          </div>
          <div className="w-24">
            <Campo
              rotulo="Quantidade"
              name="quantidade"
              placeholder="1"
              type="number"
              min={1}
              max={999}
              value={quantidade}
              onChange={(evento) => setQuantidade(Math.max(1, Number(evento.target.value) || 1))}
            />
          </div>
        </div>
      </Secao>

      {placa ? (
        <Secao titulo="Para qual negócio é esta placa">
          <div className="flex flex-col gap-4">
            <Campo
              ref={campoDoNegocio}
              rotulo="Nome do negócio"
              name="nomeNegocio"
              placeholder="Barbearia Vintage"
              autoComplete="off"
              value={nomeNegocio}
              onChange={(evento) => setNomeNegocio(evento.target.value)}
              ajuda="É este nome que vai impresso no display, no lugar do logo do Google."
            />

            <Campo
              rotulo="Link de avaliação do Google"
              name="linkAvaliacao"
              placeholder="https://g.page/r/.../review"
              inputMode="url"
              value={linkAvaliacao}
              onChange={(evento) => setLinkAvaliacao(evento.target.value)}
              ajuda="Aceita o link do g.page, o encurtado do Maps ou o endereço completo."
            />

            <div className="flex justify-end">
              <Botao type="button" onClick={adicionar}>
                <ShoppingCart size={16} aria-hidden />
                Adicionar ao carrinho
              </Botao>
            </div>
          </div>
        </Secao>
      ) : (
        <div className="flex justify-end">
          <Botao type="button" onClick={adicionar}>
            <ShoppingCart size={16} aria-hidden />
            Adicionar ao carrinho
          </Botao>
        </div>
      )}

      {temItens ? (
        <>
          <Carrinho
            itens={carrinho.itens}
            aoRemover={carrinho.remover}
            aoMudarQuantidade={carrinho.mudarQuantidade}
          />

          <EscolherCliente clientes={clientes} escolhido={cliente} aoEscolher={setCliente} />

          <Secao titulo="Fechar pedido">
            <div className="flex flex-col gap-4">
              <Campo
                rotulo="Observações"
                name="observacoes"
                placeholder="Opcional, só para você"
                value={observacoes}
                onChange={(evento) => setObservacoes(evento.target.value)}
              />

              <div className="flex flex-wrap justify-between gap-3">
                <Botao type="button" variante="secundario" onClick={carrinho.limpar}>
                  Esvaziar carrinho
                </Botao>
                <Botao type="button" onClick={fecharPedido} disabled={!cliente || fechando}>
                  {fechando ? "Fechando o pedido..." : "Fechar pedido"}
                </Botao>
              </div>
            </div>
          </Secao>
        </>
      ) : (
        <p className="text-sm text-tinta-suave">
          O carrinho está vazio. Escolha o produto e adicione.
        </p>
      )}
    </div>
  );
}

/** Foto e descricao do produto padrao, no lugar onde a placa mostra os eixos. */
function Vitrine({ produto }: { produto: ProdutoDaVenda }) {
  if (!produto.foto_url && !produto.descricao) return null;

  return (
    <div className="flex flex-wrap items-start gap-4">
      {produto.foto_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={produto.foto_url}
          alt={produto.nome}
          className="size-32 rounded-lg border border-borda object-cover"
        />
      ) : null}
      {produto.descricao ? (
        <p className="min-w-48 flex-1 text-sm text-tinta-media">{produto.descricao}</p>
      ) : null}
    </div>
  );
}

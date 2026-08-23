"use client";

import { Plus, QrCode } from "lucide-react";

import type { ProdutoDaVenda } from "./venda-rapida";
import { Botao } from "@/components/ui/botao";
import { tamanhoDasMedidas } from "@/lib/catalogo";
import { moeda, ROTULO_TECNOLOGIA } from "@/lib/formato";

/**
 * O produto na vitrine: foto, nome, preco, prazo e um botao.
 *
 * Tudo que o item precisa alem disso — cor, quantidade, para qual negocio — sai
 * no popup do "Adicionar". A tela antiga trazia esses campos abertos para o
 * produto selecionado, e com quatro produtos no catalogo isso virou um
 * formulario comprido no lugar de uma loja.
 */
export function CartaoDeProduto({
  produto,
  aoAdicionar,
}: {
  produto: ProdutoDaVenda;
  aoAdicionar: () => void;
}) {
  return (
    <article className="flex flex-col overflow-hidden rounded-card border border-borda bg-superficie transition-colors hover:border-borda-forte">
      <Imagem produto={produto} />

      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-sm font-semibold text-tinta">{produto.nome}</h3>
        <p className="mt-0.5 line-clamp-2 text-xs text-tinta-suave">{legenda(produto)}</p>

        <p className="mt-3 text-2xl font-semibold tracking-tight text-tinta tabular-nums">
          {moeda(produto.preco_centavos)}
        </p>
        <p className="text-xs text-tinta-suave">
          Entrega em {produto.prazo_entrega_dias}{" "}
          {produto.prazo_entrega_dias === 1 ? "dia" : "dias"}
        </p>

        {/* `mt-auto` gruda o botao no rodape: com nomes de uma e de duas linhas
            lado a lado, os botoes da grade ficariam em alturas diferentes. */}
        <div className="mt-4 pt-1">
          <Botao type="button" larguraTotal onClick={aoAdicionar}>
            <Plus size={16} aria-hidden />
            Adicionar
          </Botao>
        </div>
      </div>
    </article>
  );
}

/**
 * A placa nao tem foto, e nao e esquecimento: a imagem dela e a arte, que so
 * existe depois de o cliente dizer o nome do negocio. No lugar dela vai a
 * miniatura do formato, que e o que diferencia um display do outro na vitrine.
 */
function Imagem({ produto }: { produto: ProdutoDaVenda }) {
  const placa = produto.produto_avaliacao;

  if (produto.foto_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={produto.foto_url}
        alt={produto.nome}
        className="aspect-[4/3] w-full border-b border-borda bg-papel object-cover"
      />
    );
  }

  if (!placa) {
    return <div className="aspect-[4/3] w-full border-b border-borda bg-papel" />;
  }

  const tamanho = tamanhoDasMedidas(placa.largura_mm, placa.altura_mm);

  return (
    <div className="flex aspect-[4/3] w-full items-center justify-center border-b border-borda bg-papel">
      <div className="flex h-4/5 flex-col items-center justify-center gap-1.5 rounded-lg border border-borda-forte bg-superficie px-6">
        <QrCode size={26} aria-hidden className="text-tinta-media" />
        <span className="text-xs font-semibold tracking-wide text-tinta-media uppercase">
          {tamanho === "personalizado"
            ? `${Number(placa.largura_mm)}×${Number(placa.altura_mm)} mm`
            : tamanho.toUpperCase()}
        </span>
      </div>
    </div>
  );
}

/** Descricao para o produto padrao, tecnologia para a placa. */
function legenda(produto: ProdutoDaVenda): string {
  if (produto.produto_avaliacao) {
    return ROTULO_TECNOLOGIA[produto.produto_avaliacao.tecnologia];
  }
  return produto.descricao ?? "";
}

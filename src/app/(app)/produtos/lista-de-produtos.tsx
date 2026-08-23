"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { ModalProduto, type ProdutoEditavel } from "./modal-produto";
import { Botao } from "@/components/ui/botao";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { CartaoDeLista } from "@/components/ui/cartao-de-lista";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { moeda, ROTULO_TIPO_PRODUTO } from "@/lib/formato";

/** Fechado, ou aberto em `produto` (que sendo nulo quer dizer produto novo). */
type Edicao = { produto: ProdutoEditavel | null } | null;

export function ListaDeProdutos({ produtos }: { produtos: ProdutoEditavel[] }) {
  const [edicao, setEdicao] = useState<Edicao>(null);

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoDePagina
        titulo="Produtos"
        descricao={`${ROTULO_TIPO_PRODUTO.avaliacao} vira arte sozinha, calculada por proporção da largura útil. ${ROTULO_TIPO_PRODUTO.padrao} é para tudo o mais que você vende.`}
        acao={
          <Botao type="button" onClick={() => setEdicao({ produto: null })}>
            <Plus size={16} aria-hidden />
            Novo produto
          </Botao>
        }
      />

      {produtos.length === 0 ? (
        <EstadoVazio
          mensagem="Nenhum produto no catálogo ainda."
          acao={
            <Botao type="button" onClick={() => setEdicao({ produto: null })}>
              Cadastrar o primeiro
            </Botao>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {produtos.map((produto) => (
            <li key={produto.id}>
              <CartaoDeLista onClick={() => setEdicao({ produto })}>
                <div className="min-w-0">
                  <p className="truncate text-base font-medium text-tinta">
                    {produto.nome}
                    {produto.ativo ? "" : " (fora da venda)"}
                  </p>
                  <p className="text-sm text-tinta-suave tabular-nums">
                    {ROTULO_TIPO_PRODUTO[produto.tipo]} · {moeda(produto.preco_centavos)} ·{" "}
                    {produto.comissao_percentual}% de comissão
                  </p>
                </div>
                <span className="shrink-0 text-xs text-tinta-suave tabular-nums">
                  {produto.prazo_entrega_dias === 1
                    ? "1 dia"
                    : `${produto.prazo_entrega_dias} dias`}
                </span>
              </CartaoDeLista>
            </li>
          ))}
        </ul>
      )}

      {/* A `key` remonta o popup a cada abertura: os campos sao nao controlados
          e o tipo escolhido mora em estado, entao reaproveitar a instancia
          faria o produto seguinte abrir com o resto do anterior dentro. */}
      {edicao ? (
        <ModalProduto
          key={edicao.produto?.id ?? "novo"}
          aberto
          aoFechar={() => setEdicao(null)}
          produto={edicao.produto ?? undefined}
        />
      ) : null}
    </div>
  );
}

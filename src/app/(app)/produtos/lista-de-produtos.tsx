"use client";

import { Plus } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";

import { alternarProduto } from "./actions";
import { ModalProduto, type ProdutoEditavel } from "./modal-produto";
import { avisar } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { CartaoDeLista } from "@/components/ui/cartao-de-lista";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Interruptor } from "@/components/ui/interruptor";
import { moeda, ROTULO_TIPO_PRODUTO } from "@/lib/formato";

/** Fechado, ou aberto em `produto` (que sendo nulo quer dizer produto novo). */
type Edicao = { produto: ProdutoEditavel | null } | null;

export function ListaDeProdutos({ produtos }: { produtos: ProdutoEditavel[] }) {
  const [edicao, setEdicao] = useState<Edicao>(null);
  const [, iniciar] = useTransition();

  // O interruptor responde no toque e so depois confirma com o servidor. Um
  // toggle que fica meio segundo parado esperando resposta parece quebrado, e
  // quem esta desligando tres produtos seguidos toca de novo achando que falhou.
  const [lista, alternarOtimista] = useOptimistic(
    produtos,
    (atual: ProdutoEditavel[], mudanca: { id: string; ativo: boolean }) =>
      atual.map((item) => (item.id === mudanca.id ? { ...item, ativo: mudanca.ativo } : item)),
  );

  function alternar(produto: ProdutoEditavel, ativo: boolean) {
    iniciar(async () => {
      alternarOtimista({ id: produto.id, ativo });

      const resposta = await alternarProduto(produto.id, ativo);
      if (resposta.erro) avisar.erro(resposta.erro);
      else if (resposta.sucesso) avisar.sucesso(resposta.sucesso);
    });
  }

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

      {lista.length === 0 ? (
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
          {lista.map((produto) => (
            <li key={produto.id}>
              <CartaoDeLista
                onClick={() => setEdicao({ produto })}
                acao={
                  <Interruptor
                    ligado={produto.ativo}
                    rotulo={`${produto.nome} à venda`}
                    onChange={(ativo) => alternar(produto, ativo)}
                  />
                }
              >
                <div className={produto.ativo ? "min-w-0" : "min-w-0 opacity-60"}>
                  <p className="truncate text-base font-medium text-tinta">{produto.nome}</p>
                  <p className="text-sm text-tinta-suave tabular-nums">
                    {detalhe(produto)}
                  </p>
                </div>
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

function detalhe(produto: ProdutoEditavel): string {
  const dias = produto.prazo_entrega_dias === 1 ? "1 dia" : `${produto.prazo_entrega_dias} dias`;

  return [
    ROTULO_TIPO_PRODUTO[produto.tipo],
    moeda(produto.preco_centavos),
    `${produto.comissao_percentual}% de comissão`,
    dias,
  ].join(" · ");
}

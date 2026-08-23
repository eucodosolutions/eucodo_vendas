"use client";

import { Trash2 } from "lucide-react";

import { Quantidade } from "./quantidade";
import { moeda, ROTULO_COR } from "@/lib/formato";
import type { ItemDoCarrinho } from "@/lib/carrinho/carrinho";

/**
 * A lista de itens do carrinho, sem moldura.
 *
 * A moldura fica com quem a usa: hoje e a gaveta, e o resumo do fechamento
 * mostra a mesma lista sem os controles. Por isso `somenteLeitura`, e nao dois
 * componentes que precisariam ser corrigidos em dobro.
 */
export function ListaDoCarrinho({
  itens,
  aoRemover,
  aoMudarQuantidade,
  somenteLeitura,
}: {
  itens: ItemDoCarrinho[];
  aoRemover?: (chave: string) => void;
  aoMudarQuantidade?: (chave: string, quantidade: number) => void;
  somenteLeitura?: boolean;
}) {
  return (
    <ul className="flex flex-col divide-y divide-borda">
      {itens.map((item) => (
        <li key={item.chave} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-tinta">{titulo(item)}</p>
              <p className="text-xs text-tinta-suave">{detalhe(item)}</p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-tinta tabular-nums">
              {moeda(item.precoUnitarioCentavos * item.quantidade)}
            </span>
          </div>

          {somenteLeitura ? (
            <span className="text-xs text-tinta-suave tabular-nums">
              {item.quantidade} {item.quantidade === 1 ? "unidade" : "unidades"}
            </span>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <Quantidade
                valor={item.quantidade}
                aoMudar={(quantidade) => aoMudarQuantidade?.(item.chave, quantidade)}
                descricao={titulo(item)}
              />

              <button
                type="button"
                onClick={() => aoRemover?.(item.chave)}
                aria-label={`Remover ${titulo(item)} do carrinho`}
                className="flex size-9 items-center justify-center rounded-lg text-tinta-suave transition-colors hover:bg-papel hover:text-erro"
              >
                <Trash2 size={16} aria-hidden />
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * A placa aparece pelo negocio que vai impresso nela, e nao pelo produto.
 *
 * E o que o vendedor precisa distinguir no carrinho: duas placas iguais para
 * empresas diferentes sao duas linhas, e o nome do produto seria o mesmo texto
 * repetido nas duas.
 */
function titulo(item: ItemDoCarrinho): string {
  return item.nomeNegocio || item.produtoNome;
}

function detalhe(item: ItemDoCarrinho): string {
  const configuracao = [
    // O nome do produto so entra quando o titulo ja foi ocupado pelo negocio.
    item.nomeNegocio ? item.produtoNome : null,
    item.cor ? ROTULO_COR[item.cor].toLowerCase() : null,
  ]
    .filter(Boolean)
    .join(", ");

  const cada = `${moeda(item.precoUnitarioCentavos)} cada`;
  return configuracao ? `${configuracao} | ${cada}` : cada;
}

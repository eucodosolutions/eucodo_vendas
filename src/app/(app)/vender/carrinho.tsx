"use client";

import { Minus, Plus, Trash2 } from "lucide-react";

import { Secao } from "@/components/ui/secao";
import { moeda, ROTULO_COR } from "@/lib/formato";
import { pecasDoCarrinho, totalDoCarrinho, type ItemDoCarrinho } from "@/lib/carrinho/carrinho";

export function Carrinho({
  itens,
  aoRemover,
  aoMudarQuantidade,
}: {
  itens: ItemDoCarrinho[];
  aoRemover: (chave: string) => void;
  aoMudarQuantidade: (chave: string, quantidade: number) => void;
}) {
  const total = totalDoCarrinho(itens);
  const pecas = pecasDoCarrinho(itens);

  return (
    <Secao titulo={`Carrinho, ${pecas} ${pecas === 1 ? "peça" : "peças"}`}>
      <ul className="flex flex-col divide-y divide-borda">
        {itens.map((item) => (
          <li key={item.chave} className="flex flex-wrap items-center gap-3 py-3 first:pt-0">
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-medium text-tinta">{titulo(item)}</p>
              <p className="text-sm text-tinta-suave">{detalhe(item)}</p>
            </div>

            <div className="flex items-center gap-1">
              <BotaoDeQuantidade
                rotulo={`Menos um de ${titulo(item)}`}
                disabled={item.quantidade <= 1}
                onClick={() => aoMudarQuantidade(item.chave, item.quantidade - 1)}
              >
                <Minus size={15} aria-hidden />
              </BotaoDeQuantidade>

              <span className="w-8 text-center text-sm font-medium text-tinta tabular-nums">
                {item.quantidade}
              </span>

              <BotaoDeQuantidade
                rotulo={`Mais um de ${titulo(item)}`}
                onClick={() => aoMudarQuantidade(item.chave, item.quantidade + 1)}
              >
                <Plus size={15} aria-hidden />
              </BotaoDeQuantidade>
            </div>

            <span className="w-24 shrink-0 text-right text-base font-semibold text-tinta tabular-nums">
              {moeda(item.precoUnitarioCentavos * item.quantidade)}
            </span>

            <button
              type="button"
              onClick={() => aoRemover(item.chave)}
              aria-label={`Remover ${titulo(item)} do carrinho`}
              className="flex size-9 items-center justify-center rounded-lg text-tinta-suave transition-colors hover:bg-papel hover:text-erro"
            >
              <Trash2 size={16} aria-hidden />
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-end justify-between border-t border-borda pt-4">
        <span className="text-xs font-medium tracking-wide text-tinta-suave uppercase">
          Total do pedido
        </span>
        <span className="text-2xl font-semibold tracking-tight text-tinta">{moeda(total)}</span>
      </div>
    </Secao>
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

function BotaoDeQuantidade({
  rotulo,
  disabled,
  onClick,
  children,
}: {
  rotulo: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      disabled={disabled}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-lg border border-borda text-tinta-media transition-colors hover:border-borda-forte disabled:opacity-40"
    >
      {children}
    </button>
  );
}

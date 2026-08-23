"use client";

import { Minus, Plus } from "lucide-react";

/**
 * Menos, numero, mais.
 *
 * Vive fora do carrinho porque o popup de adicionar usa o mesmo controle, e a
 * venda acontece muito no celular: digitar num campo numerico abre o teclado
 * por cima de metade da tela para trocar 1 por 2.
 */
export function Quantidade({
  valor,
  aoMudar,
  descricao,
}: {
  valor: number;
  aoMudar: (quantidade: number) => void;
  /** O que os botoes dizem ao leitor de tela: "Menos um de Barbearia Vintage". */
  descricao: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <BotaoDePasso
        rotulo={`Menos um de ${descricao}`}
        disabled={valor <= 1}
        onClick={() => aoMudar(valor - 1)}
      >
        <Minus size={15} aria-hidden />
      </BotaoDePasso>

      <span className="w-8 text-center text-sm font-medium text-tinta tabular-nums">{valor}</span>

      <BotaoDePasso
        rotulo={`Mais um de ${descricao}`}
        disabled={valor >= 999}
        onClick={() => aoMudar(valor + 1)}
      >
        <Plus size={15} aria-hidden />
      </BotaoDePasso>
    </div>
  );
}

function BotaoDePasso({
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

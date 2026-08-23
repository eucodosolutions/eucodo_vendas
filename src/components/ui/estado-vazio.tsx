import type { ReactNode } from "react";

/**
 * A moldura tracejada de "ainda nao tem nada aqui".
 *
 * Tracejada de proposito: a borda inteira do cartao normal sugere conteudo que
 * nao carregou, e a lista vazia de quem acabou de criar a conta e o estado
 * certo, nao um erro.
 */
export function EstadoVazio({ mensagem, acao }: { mensagem: string; acao?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-borda-forte bg-superficie p-10 text-center">
      <p className="text-sm text-tinta-suave">{mensagem}</p>
      {acao ? <div className="mt-4 flex justify-center">{acao}</div> : null}
    </div>
  );
}

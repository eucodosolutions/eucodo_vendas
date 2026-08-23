import type { ReactNode } from "react";

/**
 * Titulo da tela, com o botao da acao principal a direita.
 *
 * O mesmo bloco aparecia escrito a mao em toda pagina do painel, e a classe do
 * `h1` viajava copiada em treze lugares. Aqui tambem mora o padrao de navegacao
 * do sistema: lista na tela, "Adicionar" no canto, cadastro em popup.
 */
export function CabecalhoDePagina({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-tinta">{titulo}</h1>
        {descricao ? <p className="mt-1 text-sm text-tinta-suave">{descricao}</p> : null}
      </div>
      {acao}
    </header>
  );
}

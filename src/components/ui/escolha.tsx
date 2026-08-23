"use client";

type EscolhaProps<T extends string> = {
  titulo: string;
  opcoes: Array<{ valor: T; rotulo: string; detalhe: string }>;
  selecionado: T;
  aoSelecionar: (valor: T) => void;
};

/**
 * Grade de escolha unica, com o preco visivel dentro da propria opcao.
 *
 * Este bloco e feito para ser virado para o cliente ver: por isso o preco fica
 * na opcao, e nao numa tabela ao lado.
 */
export function Escolha<T extends string>({
  titulo,
  opcoes,
  selecionado,
  aoSelecionar,
}: EscolhaProps<T>) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold tracking-wide text-tinta-suave uppercase">
        {titulo}
      </legend>
      <div className="grid grid-cols-2 gap-3">
        {opcoes.map((opcao) => {
          const ativo = opcao.valor === selecionado;
          return (
            <button
              key={opcao.valor}
              type="button"
              onClick={() => aoSelecionar(opcao.valor)}
              aria-pressed={ativo}
              className={`flex min-h-14 flex-col items-start justify-center rounded-lg border px-4 py-2.5 text-left transition-colors ${
                ativo
                  ? "border-marca bg-marca-suave"
                  : "border-borda bg-superficie hover:border-borda-forte"
              }`}
            >
              <span className={`text-sm font-medium ${ativo ? "text-marca" : "text-tinta"}`}>
                {opcao.rotulo}
              </span>
              <span className="text-sm text-tinta-suave tabular-nums">{opcao.detalhe}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

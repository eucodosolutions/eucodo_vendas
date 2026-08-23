"use client";

import { useId, type ReactNode } from "react";

import { useAoDarCerto, useAviso, type EstadoComAviso } from "./avisos";
import { Botao } from "./botao";
import { Modal } from "./modal";

type ConfirmacaoProps = {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  /** O que acontece se a pessoa seguir. Frase inteira, sem enrolar. */
  mensagem: string;
  acao: (dados: FormData) => void;
  estado: EstadoComAviso;
  pendente: boolean;
  confirmarRotulo: string;
  carregandoTexto?: string;
  /** Campos pedidos junto da confirmacao, tipo o motivo de um cancelamento. */
  children?: ReactNode;
  /** Campos ocultos que a action precisa, tipo o id do registro. */
  ocultos?: Record<string, string>;
};

/**
 * Popup de "tem certeza?" para o que nao volta atras.
 *
 * Existe porque as acoes destrutivas do painel tinham cada uma o seu jeito: o
 * `confirm()` cru do navegador em um lugar, nada nenhum em outro, e um
 * formulario que brotava no meio da pagina no terceiro. Acertar comissao e
 * apagar cliente merecem a mesma pergunta, feita do mesmo jeito.
 *
 * O botao de confirmar e sempre `secundario`: quem chega aqui ja decidiu, e um
 * botao azul chamativo no caminho de uma acao irreversivel convida ao engano.
 */
export function Confirmacao({
  aberto,
  aoFechar,
  titulo,
  mensagem,
  acao,
  estado,
  pendente,
  confirmarRotulo,
  carregandoTexto = "Confirmando...",
  children,
  ocultos,
}: ConfirmacaoProps) {
  const idDoFormulario = useId();

  useAviso(estado);
  useAoDarCerto(estado, aoFechar);

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={titulo}
      tamanho="estreito"
      rodape={
        <>
          <Botao type="button" variante="fantasma" onClick={aoFechar} disabled={pendente}>
            Deixar como está
          </Botao>
          <Botao
            type="submit"
            form={idDoFormulario}
            variante="secundario"
            disabled={pendente}
            carregandoTexto={carregandoTexto}
          >
            {confirmarRotulo}
          </Botao>
        </>
      }
    >
      <form id={idDoFormulario} action={acao} className="flex flex-col gap-4">
        <p className="text-sm text-tinta-media">{mensagem}</p>

        {Object.entries(ocultos ?? {}).map(([nome, valor]) => (
          <input key={nome} type="hidden" name={nome} value={valor} />
        ))}

        {children}
      </form>
    </Modal>
  );
}

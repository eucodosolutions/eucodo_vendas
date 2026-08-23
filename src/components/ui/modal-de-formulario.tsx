"use client";

import { useId, type ReactNode } from "react";

import { useAoDarCerto, useAviso, type EstadoComAviso } from "./avisos";
import { Botao } from "./botao";
import { Modal } from "./modal";

type ModalDeFormularioProps = {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  /** O `dispatch` do `useActionState` de quem chamou. */
  acao: (dados: FormData) => void;
  /** O estado do mesmo `useActionState`: e ele que avisa e fecha o popup. */
  estado: EstadoComAviso;
  pendente: boolean;
  children: ReactNode;
  /** Botao extra no canto esquerdo do rodape, tipo "Remover". */
  acaoSecundaria?: ReactNode;
  salvarRotulo?: string;
  carregandoTexto?: string;
  tamanho?: "estreito" | "medio" | "largo";
};

/**
 * Popup de cadastro e edicao: formulario dentro, Cancelar e Salvar no rodape.
 *
 * Fecha sozinho quando a action responde sucesso, e so nesse caso. Erro mantem
 * o popup aberto com o que a pessoa digitou, porque o aviso sai em toast e um
 * popup que se fecha junto levaria embora o formulario e a chance de corrigir.
 *
 * Os botoes ficam fora do `<form>` para nao rolarem com o conteudo, e se ligam
 * a ele pelo atributo `form`. Por isso o `pendente` vem de fora: `useFormStatus`
 * so enxerga botao que esteja dentro da arvore do formulario.
 */
export function ModalDeFormulario({
  aberto,
  aoFechar,
  titulo,
  descricao,
  acao,
  estado,
  pendente,
  children,
  acaoSecundaria,
  salvarRotulo = "Salvar",
  carregandoTexto = "Salvando...",
  tamanho = "medio",
}: ModalDeFormularioProps) {
  const idDoFormulario = useId();

  useAviso(estado);
  useAoDarCerto(estado, aoFechar);

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={titulo}
      descricao={descricao}
      tamanho={tamanho}
      rodape={
        <>
          {acaoSecundaria ? <div className="mr-auto">{acaoSecundaria}</div> : null}
          <Botao type="button" variante="secundario" onClick={aoFechar} disabled={pendente}>
            Cancelar
          </Botao>
          <Botao
            type="submit"
            form={idDoFormulario}
            disabled={pendente}
            carregandoTexto={carregandoTexto}
          >
            {salvarRotulo}
          </Botao>
        </>
      }
    >
      <form id={idDoFormulario} action={acao} className="flex flex-col gap-4">
        {children}
      </form>
    </Modal>
  );
}

"use client";

import { useActionState, useId } from "react";

import { gerarNovaSenha, type EstadoEquipe } from "./actions";
import { CartaoDeAcesso } from "./cartao-de-acesso";
import { useAviso } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Modal } from "@/components/ui/modal";

/**
 * Confirmacao de nova senha, em duas etapas dentro da mesma janela.
 *
 * Nao usa a `Confirmacao` de proposito, pelo mesmo motivo do cadastro de
 * vendedor: aquela fecha ao dar certo, e aqui o resultado e justamente o que
 * precisa ficar na tela para o dono copiar e mandar no WhatsApp.
 *
 * Componente proprio, e nao um bloco dentro de `AcoesDoVendedor`, porque o
 * `useActionState` guarda a senha gerada: so remontando ele se apaga, e quem
 * remonta e a `key` de quem chama.
 */
export function ModalNovaSenha({
  aberto,
  aoFechar,
  nome,
  vendedorId,
}: {
  aberto: boolean;
  aoFechar: () => void;
  nome: string;
  vendedorId: string;
}) {
  const [estado, acao, gerando] = useActionState<EstadoEquipe, FormData>(gerarNovaSenha, {});
  const idDoFormulario = useId();

  useAviso(estado);

  const primeiroNome = nome.split(" ")[0];
  const acesso = estado.acesso;

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={acesso ? `Nova senha de ${primeiroNome}` : `Gerar nova senha para ${primeiroNome}?`}
      tamanho="estreito"
      rodape={
        acesso ? (
          <Botao type="button" onClick={aoFechar}>
            Já mandei, pode fechar
          </Botao>
        ) : (
          <>
            <Botao type="button" variante="fantasma" onClick={aoFechar} disabled={gerando}>
              Deixar como está
            </Botao>
            <Botao
              type="submit"
              form={idDoFormulario}
              variante="secundario"
              disabled={gerando}
              carregandoTexto="Gerando..."
            >
              Gerar nova senha
            </Botao>
          </>
        )
      }
    >
      {acesso ? (
        <CartaoDeAcesso acesso={acesso} />
      ) : (
        <form id={idDoFormulario} action={acao}>
          <input type="hidden" name="vendedorId" value={vendedorId} />
          <p className="text-sm text-tinta-media">
            A senha que {primeiroNome} usa hoje para de funcionar na hora. A nova aparece aqui uma
            vez só, para você mandar no WhatsApp.
          </p>
        </form>
      )}
    </Modal>
  );
}

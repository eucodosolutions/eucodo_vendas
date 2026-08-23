"use client";

import { useActionState, useId } from "react";

import { cadastrarVendedor, type EstadoEquipe } from "./actions";
import { CartaoDeAcesso } from "./cartao-de-acesso";
import { useAviso } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { CampoWhatsapp } from "@/components/ui/campo-whatsapp";
import { Modal } from "@/components/ui/modal";

/**
 * Cadastro de vendedor em popup, em duas etapas dentro da mesma janela.
 *
 * Nao usa o `ModalDeFormulario` de proposito: aquele fecha ao dar certo, e aqui
 * o sucesso e justamente o que precisa ficar na tela. A senha provisoria sai da
 * Edge Function e nao e guardada em lugar nenhum — se o popup fechasse junto, o
 * unico caminho seria gerar outra.
 */
export function ModalNovoVendedor({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const [estado, acao, pendente] = useActionState<EstadoEquipe, FormData>(cadastrarVendedor, {});
  const idDoFormulario = useId();

  useAviso(estado);

  const acesso = estado.acesso;

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={acesso ? "Vendedor cadastrado" : "Novo vendedor"}
      descricao={
        acesso ? undefined : "Ele entra com uma senha provisória e troca no primeiro acesso."
      }
      rodape={
        acesso ? (
          <Botao type="button" onClick={aoFechar}>
            Já mandei, pode fechar
          </Botao>
        ) : (
          <>
            <Botao type="button" variante="secundario" onClick={aoFechar} disabled={pendente}>
              Cancelar
            </Botao>
            <Botao
              type="submit"
              form={idDoFormulario}
              disabled={pendente}
              carregandoTexto="Criando acesso..."
            >
              Cadastrar vendedor
            </Botao>
          </>
        )
      }
    >
      {acesso ? (
        <CartaoDeAcesso acesso={acesso} />
      ) : (
        <form id={idDoFormulario} action={acao} className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome" name="nome" placeholder="Maria Souza" autoComplete="off" required />
          <Campo
            rotulo="E-mail"
            name="email"
            type="email"
            placeholder="maria@empresa.com.br"
            autoComplete="off"
            inputMode="email"
            required
          />
          <CampoWhatsapp
            rotulo="WhatsApp"
            required
            autoComplete="off"
            ajuda="É por aqui que você manda o acesso."
          />
        </form>
      )}
    </Modal>
  );
}

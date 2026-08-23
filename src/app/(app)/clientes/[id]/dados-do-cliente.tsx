"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useState } from "react";

import { removerCliente, type EstadoCliente } from "../actions";
import { ModalCliente, type ClienteEditavel } from "../modal-cliente";
import { useAoDarCerto } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Confirmacao } from "@/components/ui/confirmacao";
import { Dado, Secao } from "@/components/ui/secao";
import { whatsappLegivel } from "@/lib/formato";

/**
 * O cadastro do cliente em leitura, com Editar e Remover no cabecalho.
 *
 * Antes o dono da conta via um formulario sempre aberto e o vendedor via uma
 * versao so de leitura, escrita a parte: dois desenhos do mesmo bloco, que
 * envelheciam separados. Agora todo mundo ve o mesmo, e quem pode editar ganha
 * o botao que abre o popup.
 */
export function DadosDoCliente({
  cliente,
  podeEditar,
}: {
  cliente: ClienteEditavel;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [estadoRemocao, acaoRemocao, removendo] = useActionState<EstadoCliente, FormData>(
    removerCliente,
    {},
  );

  const [editando, setEditando] = useState(false);
  const [rodada, setRodada] = useState(0);
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);

  // Quem avisa pela remocao e a propria `Confirmacao`. Aqui so falta sair da
  // pagina, que a partir de agora aponta para o que nao existe mais.
  useAoDarCerto(
    estadoRemocao,
    useCallback(() => router.push("/clientes"), [router]),
  );

  function fecharEdicao() {
    setEditando(false);
    setRodada((valor) => valor + 1);
  }

  return (
    <>
      <Secao
        titulo="Dados do cliente"
        acao={
          podeEditar ? (
            <div className="flex gap-2">
              <Botao type="button" variante="fantasma" onClick={() => setEditando(true)}>
                <Pencil size={16} aria-hidden />
                Editar
              </Botao>
              <Botao
                type="button"
                variante="fantasma"
                onClick={() => setConfirmandoRemocao(true)}
                aria-label={`Remover ${cliente.nome}`}
              >
                <Trash2 size={16} aria-hidden />
                Remover
              </Botao>
            </div>
          ) : undefined
        }
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          <Dado rotulo="Nome" valor={cliente.nome} />
          <Dado rotulo="WhatsApp" valor={whatsappLegivel(cliente.whatsapp)} />
          <Dado
            rotulo="Link de avaliação"
            valor={
              cliente.link_avaliacao ? (
                <a
                  href={cliente.link_avaliacao}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="break-all text-marca hover:underline"
                >
                  {cliente.link_avaliacao}
                </a>
              ) : (
                "Não cadastrado"
              )
            }
          />
          <Dado rotulo="Observações" valor={cliente.observacoes ?? "Nenhuma"} />
        </dl>

        {podeEditar ? null : (
          // A policy de update e do dono da conta: sem o aviso, o vendedor fica
          // procurando um botao de editar que nunca vai existir para ele.
          <p className="mt-4 text-xs text-tinta-suave">
            Alterar ou remover cliente é com o dono da conta.
          </p>
        )}
      </Secao>

      {podeEditar ? (
        <>
          <ModalCliente
            key={rodada}
            aberto={editando}
            aoFechar={fecharEdicao}
            cliente={cliente}
          />

          <Confirmacao
            aberto={confirmandoRemocao}
            aoFechar={() => setConfirmandoRemocao(false)}
            titulo={`Remover ${cliente.nome}?`}
            mensagem="O cliente sai da sua lista para sempre. Quem já tem pedido no sistema não pode ser removido: o histórico da venda iria junto."
            acao={acaoRemocao}
            estado={estadoRemocao}
            pendente={removendo}
            confirmarRotulo="Remover cliente"
            carregandoTexto="Removendo..."
            ocultos={{ id: cliente.id }}
          />
        </>
      ) : null}
    </>
  );
}

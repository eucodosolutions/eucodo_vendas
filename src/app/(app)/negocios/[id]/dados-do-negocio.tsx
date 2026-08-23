"use client";

import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useState } from "react";

import { removerNegocio, type EstadoNegocio } from "../actions";
import { ModalNegocio, type NegocioEditavel } from "../modal-negocio";
import { useAoDarCerto } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Confirmacao } from "@/components/ui/confirmacao";
import { Dado, Secao } from "@/components/ui/secao";

/**
 * O cadastro do negocio em leitura, com Editar e Remover no cabecalho.
 *
 * Mesmo desenho da tela de cliente: todo mundo ve o mesmo bloco, e quem pode
 * editar ganha os botoes. `podeEditar` vem de fora porque a regra e do banco —
 * mexe no negocio quem cadastrou, mais o dono da conta.
 */
export function DadosDoNegocio({
  negocio,
  podeEditar,
}: {
  negocio: NegocioEditavel;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [estadoRemocao, acaoRemocao, removendo] = useActionState<EstadoNegocio, FormData>(
    removerNegocio,
    {},
  );

  const [editando, setEditando] = useState(false);
  const [rodada, setRodada] = useState(0);
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);

  // Quem avisa pela remocao e a propria `Confirmacao`. Aqui so falta sair da
  // pagina, que a partir de agora aponta para o que nao existe mais.
  useAoDarCerto(
    estadoRemocao,
    useCallback(() => router.push("/negocios"), [router]),
  );

  function fecharEdicao() {
    setEditando(false);
    setRodada((valor) => valor + 1);
  }

  return (
    <>
      <Secao
        titulo="Dados do negócio"
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
                aria-label={`Remover ${negocio.nome}`}
              >
                <Trash2 size={16} aria-hidden />
                Remover
              </Botao>
            </div>
          ) : undefined
        }
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          <Dado rotulo="Nome" valor={negocio.nome} />
          <Dado rotulo="Endereço" valor={negocio.endereco ?? "Não informado"} />
          <Dado
            rotulo="Link de avaliação"
            valor={
              // Abrir de verdade e a unica conferencia que vale: o link ou cai
              // na caixa de avaliacao, ou nao serve para virar QR em acrilico.
              <a
                href={negocio.link_avaliacao}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 break-all text-marca hover:underline"
              >
                {negocio.link_avaliacao}
                <ExternalLink size={13} aria-hidden className="shrink-0" />
              </a>
            }
          />
          <Dado rotulo="Observações" valor={negocio.observacoes ?? "Nenhuma"} />
        </dl>

        {podeEditar ? null : (
          // Sem o aviso, quem abriu o cadastro fica procurando um botao de
          // editar que nao existe para ele.
          <p className="mt-4 text-xs text-tinta-suave">
            Este negócio foi cadastrado por outra pessoa da equipe. Alterar ou remover é com quem
            cadastrou, ou com o dono da conta.
          </p>
        )}
      </Secao>

      {podeEditar ? (
        <>
          <ModalNegocio
            key={rodada}
            aberto={editando}
            aoFechar={fecharEdicao}
            negocio={negocio}
          />

          <Confirmacao
            aberto={confirmandoRemocao}
            aoFechar={() => setConfirmandoRemocao(false)}
            titulo={`Remover ${negocio.nome}?`}
            mensagem="O negócio sai da sua lista. Os pedidos já feitos para ele continuam como estão: o nome e o link que foram impressos ficam guardados em cada placa."
            acao={acaoRemocao}
            estado={estadoRemocao}
            pendente={removendo}
            confirmarRotulo="Remover negócio"
            carregandoTexto="Removendo..."
            ocultos={{ id: negocio.id }}
          />
        </>
      ) : null}
    </>
  );
}

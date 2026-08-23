"use client";

import { useActionState, useState } from "react";

import { salvarNegocio, type EstadoNegocio } from "./actions";
import { BuscaDeNegocio, type NegocioEscolhido } from "@/components/ui/busca-de-negocio";
import { Campo } from "@/components/ui/campo";
import { ModalDeFormulario } from "@/components/ui/modal-de-formulario";
import type { Negocio } from "@/types/database";

export type NegocioEditavel = Pick<
  Negocio,
  "id" | "nome" | "link_avaliacao" | "google_place_id" | "endereco" | "observacoes"
>;

/** O minimo que quem chamou precisa para seguir com o negocio recem-gravado. */
export type NegocioGravado = { id: string; nome: string; link_avaliacao: string };

/**
 * Cadastro e edicao de negocio, em popup.
 *
 * O link vem primeiro porque ele e a identidade da linha, e o nome vem depois
 * porque quase sempre chega preenchido pela busca — o campo existe para ser
 * ajustado, e nao digitado do zero.
 *
 * Nao ha WhatsApp aqui de proposito. Este cadastro nasce no planejamento da
 * rota, antes de existir conversa com ninguem; quem paga e o cliente, que e
 * outro cadastro, e so aparece na hora de fechar o pedido.
 */
export function ModalNegocio({
  aberto,
  aoFechar,
  negocio,
  aoSalvar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  negocio?: NegocioEditavel;
  /** Chamado depois de gravar, para quem precisa seguir com o negocio na mao. */
  aoSalvar?: (gravado: NegocioGravado) => void;
}) {
  const [escolhido, setEscolhido] = useState<NegocioEscolhido | null>(
    negocio
      ? {
          id: negocio.id,
          nome: negocio.nome,
          linkAvaliacao: negocio.link_avaliacao,
          placeId: negocio.google_place_id ?? undefined,
          endereco: negocio.endereco ?? undefined,
        }
      : null,
  );
  const [nome, setNome] = useState(negocio?.nome ?? "");

  const [estado, acao, pendente] = useActionState<EstadoNegocio, FormData>(
    async (anterior, dados) => {
      const resposta = await salvarNegocio(anterior, dados);

      if (resposta.negocioId && aoSalvar) {
        aoSalvar({
          id: resposta.negocioId,
          nome: String(dados.get("nome") ?? "").trim(),
          link_avaliacao: String(dados.get("linkAvaliacao") ?? ""),
        });
      }

      return resposta;
    },
    {},
  );

  function escolher(negocioEscolhido: NegocioEscolhido | null) {
    setEscolhido(negocioEscolhido);
    // O nome do Google entra como sugestao e continua editavel: "Barbearia
    // Vintage LTDA" nao e como o dono chama o proprio negocio. Trocar de
    // negocio limpa o campo, senao o nome do anterior ficaria colado no
    // link do novo.
    setNome(negocioEscolhido?.nome ?? "");
  }

  return (
    <ModalDeFormulario
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={negocio ? "Editar negócio" : "Novo negócio"}
      descricao={
        negocio ? undefined : "Encontre o negócio no Google e ele entra na sua lista de visitas."
      }
      acao={acao}
      estado={estado}
      pendente={pendente}
      salvarRotulo={negocio ? "Salvar alterações" : "Cadastrar negócio"}
    >
      {negocio ? <input type="hidden" name="id" value={negocio.id} /> : null}

      {/* O que a busca resolveu viaja escondido: o `BuscaDeNegocio` e estado de
          React, e o formulario so enxerga campo de verdade. */}
      <input type="hidden" name="linkAvaliacao" value={escolhido?.linkAvaliacao ?? ""} />
      <input type="hidden" name="placeId" value={escolhido?.placeId ?? ""} />
      <input type="hidden" name="endereco" value={escolhido?.endereco ?? ""} />

      <BuscaDeNegocio escolhido={escolhido} aoEscolher={escolher} />

      {escolhido ? (
        <>
          <Campo
            rotulo="Nome do negócio"
            name="nome"
            placeholder="Barbearia Vintage"
            autoComplete="off"
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
            required
            ajuda="Como você quer ver este negócio na sua lista. Dá para mudar depois."
          />

          <Campo
            rotulo="Observações"
            name="observacoes"
            placeholder="Opcional: falar com o gerente, voltar terça de manhã"
            defaultValue={negocio?.observacoes ?? ""}
          />
        </>
      ) : null}
    </ModalDeFormulario>
  );
}

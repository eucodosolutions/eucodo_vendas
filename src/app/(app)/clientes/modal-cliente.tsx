"use client";

import { useActionState, useState } from "react";

import { salvarCliente, type EstadoCliente } from "./actions";
import { BuscaDeNegocio, type NegocioEscolhido } from "@/components/ui/busca-de-negocio";
import { Campo } from "@/components/ui/campo";
import { CampoWhatsapp } from "@/components/ui/campo-whatsapp";
import { ModalDeFormulario } from "@/components/ui/modal-de-formulario";
import { normalizarWhatsapp } from "@/lib/formato";
import type { Cliente } from "@/types/database";

export type ClienteEditavel = Pick<
  Cliente,
  "id" | "nome" | "whatsapp" | "google_place_id" | "link_avaliacao" | "observacoes"
>;

/** O minimo que quem chamou precisa para seguir com o cliente recem-gravado. */
export type ClienteGravado = { id: string; nome: string; whatsapp: string };

/**
 * Cadastro e edicao de cliente, em popup.
 *
 * Nome e WhatsApp sao obrigatorios, e o resto e conveniencia: o numero e o que
 * amarra o cliente ao historico e o destino de tudo que o sistema manda, entao
 * nao existe cliente sem ele.
 */
export function ModalCliente({
  aberto,
  aoFechar,
  cliente,
  aoSalvar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  cliente?: ClienteEditavel;
  /**
   * Chamado depois de gravar, para quem precisa seguir com o cliente na mao —
   * a tela de venda escolhe na hora o que acabou de cadastrar.
   */
  aoSalvar?: (gravado: ClienteGravado) => void;
}) {
  // Cliente ja cadastrado com link volta como negocio resolvido: o popup abre
  // mostrando o que esta gravado, e nao uma busca vazia que parece perda.
  const [negocio, setNegocio] = useState<NegocioEscolhido | null>(
    cliente?.link_avaliacao
      ? {
          nome: cliente.nome,
          linkAvaliacao: cliente.link_avaliacao,
          placeId: cliente.google_place_id ?? undefined,
        }
      : null,
  );

  const [estado, acao, pendente] = useActionState<EstadoCliente, FormData>(
    async (anterior, dados) => {
      const resposta = await salvarCliente(anterior, dados);

      if (resposta.clienteId && aoSalvar) {
        const whatsapp = normalizarWhatsapp(String(dados.get("whatsapp") ?? ""));
        aoSalvar({
          id: resposta.clienteId,
          nome: String(dados.get("nome") ?? "").trim(),
          // O servidor so grava numero valido, entao aqui ele sempre normaliza.
          whatsapp: whatsapp ?? "",
        });
      }

      return resposta;
    },
    {},
  );

  return (
    <ModalDeFormulario
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={cliente ? "Editar cliente" : "Novo cliente"}
      acao={acao}
      estado={estado}
      pendente={pendente}
      salvarRotulo={cliente ? "Salvar alterações" : "Cadastrar cliente"}
    >
      {cliente ? <input type="hidden" name="id" value={cliente.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          rotulo="Nome"
          name="nome"
          placeholder="Barbearia Vintage"
          autoComplete="off"
          defaultValue={cliente?.nome}
          required
        />
        <CampoWhatsapp required valorInicial={cliente?.whatsapp ?? ""} autoComplete="off" />
      </div>

      {/* O link nao e digitado: ele viaja escondido, do jeito que o Google
          devolveu. Opcional aqui — serve para ja vir pronto na proxima venda. */}
      <input type="hidden" name="linkAvaliacao" value={negocio?.linkAvaliacao ?? ""} />
      <input type="hidden" name="placeId" value={negocio?.placeId ?? ""} />
      <BuscaDeNegocio escolhido={negocio} aoEscolher={setNegocio} />

      <Campo
        rotulo="Observações"
        name="observacoes"
        placeholder="Opcional, só para você"
        defaultValue={cliente?.observacoes ?? ""}
      />
    </ModalDeFormulario>
  );
}

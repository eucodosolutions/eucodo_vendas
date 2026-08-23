"use client";

import { useActionState } from "react";

import { salvarCliente, type EstadoCliente } from "./actions";
import { Campo } from "@/components/ui/campo";
import { CampoWhatsapp } from "@/components/ui/campo-whatsapp";
import { ModalDeFormulario } from "@/components/ui/modal-de-formulario";
import { normalizarWhatsapp } from "@/lib/formato";
import type { Cliente } from "@/types/database";

export type ClienteEditavel = Pick<Cliente, "id" | "nome" | "whatsapp" | "observacoes">;

/** O minimo que quem chamou precisa para seguir com o cliente recem-gravado. */
export type ClienteGravado = { id: string; nome: string; whatsapp: string };

/**
 * Cadastro e edicao de cliente, em popup.
 *
 * Nome e WhatsApp sao obrigatorios, e o resto e conveniencia: o numero e o que
 * amarra o cliente ao historico e o destino de tudo que o sistema manda, entao
 * nao existe cliente sem ele.
 *
 * Os dois sugeridos servem a quem chega pela busca do fechamento: o vendedor ja
 * digitou o nome (ou o numero) uma vez para procurar, e digitar de novo no
 * cadastro e a chance de sair diferente do que ele acabou de ler na tela.
 */
export function ModalCliente({
  aberto,
  aoFechar,
  cliente,
  nomeSugerido,
  whatsappSugerido,
  aoSalvar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  cliente?: ClienteEditavel;
  /** Ignorados na edicao, onde o que vale e o que ja esta gravado. */
  nomeSugerido?: string;
  whatsappSugerido?: string;
  /**
   * Chamado depois de gravar, para quem precisa seguir com o cliente na mao —
   * a tela de venda escolhe na hora o que acabou de cadastrar.
   */
  aoSalvar?: (gravado: ClienteGravado) => void;
}) {
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
          defaultValue={cliente?.nome ?? nomeSugerido}
          required
        />
        <CampoWhatsapp
          required
          valorInicial={cliente?.whatsapp ?? whatsappSugerido ?? ""}
          autoComplete="off"
        />
      </div>

      {/* Nao ha link de avaliacao aqui de proposito: ele e do negocio, e o
          cliente pode levar placa de mais de um. Quem resolve o negocio e o
          item da venda. */}
      <Campo
        rotulo="Observações"
        name="observacoes"
        placeholder="Opcional, só para você"
        defaultValue={cliente?.observacoes ?? ""}
      />
    </ModalDeFormulario>
  );
}

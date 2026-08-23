"use client";

import { useActionState } from "react";

import { salvarCliente, type EstadoCliente } from "./actions";
import { useAviso } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { CampoWhatsapp } from "@/components/ui/campo-whatsapp";
import { Secao } from "@/components/ui/secao";
import type { Cliente } from "@/types/database";

type ClienteEditavel = Pick<
  Cliente,
  "id" | "nome" | "whatsapp" | "link_avaliacao" | "observacoes"
>;

/**
 * Nome e WhatsApp sao obrigatorios, e o resto e conveniencia.
 *
 * O numero e o que amarra o cliente ao historico e o destino de tudo que o
 * sistema manda, entao nao existe cliente sem ele.
 */
export function FormularioCliente({ cliente }: { cliente?: ClienteEditavel }) {
  const [estado, acao] = useActionState<EstadoCliente, FormData>(salvarCliente, {});
  useAviso(estado);

  const editando = Boolean(cliente);

  return (
    <Secao titulo={editando ? "Dados do cliente" : "Novo cliente"}>
      <form action={acao} className="flex flex-col gap-4">
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

        <Campo
          rotulo="Link de avaliação do Google"
          name="linkAvaliacao"
          placeholder="https://g.page/r/.../review"
          inputMode="url"
          defaultValue={cliente?.link_avaliacao ?? ""}
          ajuda="Opcional. Quando preenchido, já vem pronto na próxima venda para este cliente."
        />

        <Campo
          rotulo="Observações"
          name="observacoes"
          placeholder="Opcional, só para você"
          defaultValue={cliente?.observacoes ?? ""}
        />

        <div className="flex justify-end">
          <Botao type="submit" carregandoTexto="Salvando...">
            {editando ? "Salvar alterações" : "Cadastrar cliente"}
          </Botao>
        </div>
      </form>
    </Secao>
  );
}

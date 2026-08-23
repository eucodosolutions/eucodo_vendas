"use client";

import { useActionState } from "react";

import { salvarConfiguracoes, type EstadoAjustes } from "./actions";
import { useAviso } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { Secao } from "@/components/ui/secao";
import type { Configuracoes } from "@/types/database";

export function FormularioConfiguracoes({ configuracoes }: { configuracoes: Configuracoes }) {
  const [estado, acao] = useActionState<EstadoAjustes, FormData>(salvarConfiguracoes, {});
  useAviso(estado);

  return (
    <Secao titulo="Pagamento">
      <form action={acao} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            rotulo="Chave PIX"
            name="pixChave"
            placeholder="85987073847 ou o e-mail da conta"
            defaultValue={configuracoes.pix_chave ?? ""}
            ajuda="É a chave que vai no código copia e cola da mensagem."
          />
          <Campo
            rotulo="Nome do recebedor"
            name="pixBeneficiario"
            placeholder="Eucodo Solutions"
            defaultValue={configuracoes.pix_beneficiario ?? ""}
          />
          <Campo
            rotulo="Cidade do recebedor"
            name="pixCidade"
            placeholder="Fortaleza"
            defaultValue={configuracoes.pix_cidade ?? ""}
          />
        </div>

        <div className="flex justify-end">
          <Botao type="submit" carregandoTexto="Salvando...">
            Salvar
          </Botao>
        </div>
      </form>
    </Secao>
  );
}

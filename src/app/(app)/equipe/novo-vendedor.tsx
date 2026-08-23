"use client";

import { useActionState } from "react";

import { cadastrarVendedor, type EstadoEquipe } from "./actions";
import { CartaoDeAcesso } from "./cartao-de-acesso";
import { useAviso } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { CampoWhatsapp } from "@/components/ui/campo-whatsapp";
import { Secao } from "@/components/ui/secao";

export function NovoVendedor() {
  const [estado, acao] = useActionState<EstadoEquipe, FormData>(cadastrarVendedor, {});
  useAviso(estado);

  return (
    <Secao titulo="Novo vendedor">
      <form action={acao} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            rotulo="Nome"
            name="nome"
            placeholder="Maria Souza"
            autoComplete="off"
            required
          />
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
        </div>

        <div className="flex justify-end">
          <Botao type="submit" carregandoTexto="Criando acesso...">
            Cadastrar vendedor
          </Botao>
        </div>
      </form>

      {estado.acesso ? (
        <div className="mt-4">
          <CartaoDeAcesso acesso={estado.acesso} />
        </div>
      ) : null}
    </Secao>
  );
}

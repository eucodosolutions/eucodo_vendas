"use client";

import Link from "next/link";
import { useActionState } from "react";

import { enviarLinkDeSenha, type EstadoFormulario } from "../actions";
import { useAviso } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";

export function FormularioEsqueciSenha() {
  const [estado, acao] = useActionState<EstadoFormulario, FormData>(enviarLinkDeSenha, {});
  useAviso(estado);

  return (
    <form action={acao} className="flex flex-col gap-4">
      <Campo
        rotulo="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        autoFocus
      />

      <Botao type="submit" carregandoTexto="Enviando..." larguraTotal>
        Enviar link
      </Botao>

      <Link href="/entrar" className="text-sm font-medium text-marca hover:underline">
        Voltar para o login
      </Link>
    </form>
  );
}

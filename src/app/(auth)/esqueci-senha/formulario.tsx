"use client";

import Link from "next/link";
import { useActionState } from "react";

import { enviarLinkDeSenha, type EstadoFormulario } from "../actions";
import { Alerta } from "@/components/ui/alerta";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";

export function FormularioEsqueciSenha() {
  const [estado, acao] = useActionState<EstadoFormulario, FormData>(enviarLinkDeSenha, {});

  return (
    <form action={acao} className="flex flex-col gap-4">
      {estado.erro ? <Alerta tom="erro">{estado.erro}</Alerta> : null}
      {estado.sucesso ? <Alerta tom="sucesso">{estado.sucesso}</Alerta> : null}

      <Campo
        rotulo="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        autoFocus
      />

      <Botao type="submit" carregandoTexto="Enviando...">
        Enviar link
      </Botao>

      <Link href="/entrar" className="text-sm font-medium text-marca hover:underline">
        Voltar para o login
      </Link>
    </form>
  );
}

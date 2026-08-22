"use client";

import Link from "next/link";
import { useActionState } from "react";

import { criarConta, type EstadoFormulario } from "../actions";
import { Alerta } from "@/components/ui/alerta";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";

export function FormularioCriarConta() {
  const [estado, acao] = useActionState<EstadoFormulario, FormData>(criarConta, {});

  if (estado.sucesso) {
    return (
      <div className="flex flex-col gap-4">
        <Alerta tom="sucesso">{estado.sucesso}</Alerta>
        <Link href="/entrar" className="text-sm font-medium text-marca hover:underline">
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <form action={acao} className="flex flex-col gap-4">
      {estado.erro ? <Alerta tom="erro">{estado.erro}</Alerta> : null}

      <Campo rotulo="Seu nome" name="nome" autoComplete="name" required autoFocus />
      <Campo
        rotulo="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
      />
      <Campo
        rotulo="Senha"
        name="senha"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        ajuda="Pelo menos 8 caracteres."
      />

      <Botao type="submit" carregandoTexto="Criando...">
        Criar conta
      </Botao>

      <p className="text-sm text-tinta-suave">
        Ja tem acesso?{" "}
        <Link href="/entrar" className="font-medium text-marca hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}

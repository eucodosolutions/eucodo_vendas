"use client";

import Link from "next/link";
import { useActionState } from "react";

import { entrar, type EstadoFormulario } from "../actions";
import { useAviso } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";

export function FormularioEntrar({ proxima }: { proxima?: string }) {
  const [estado, acao] = useActionState<EstadoFormulario, FormData>(entrar, {});
  useAviso(estado);

  return (
    <form action={acao} className="flex flex-col gap-4">
      {proxima ? <input type="hidden" name="proxima" value={proxima} /> : null}

      <Campo
        rotulo="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        autoFocus
      />
      <Campo rotulo="Senha" name="senha" type="password" autoComplete="current-password" required />

      <Botao type="submit" carregandoTexto="Entrando..." larguraTotal>
        Entrar
      </Botao>

      <div className="flex items-center justify-between text-sm">
        <Link href="/esqueci-senha" className="font-medium text-marca hover:underline">
          Esqueci minha senha
        </Link>
        <Link href="/criar-conta" className="font-medium text-tinta-media hover:underline">
          Criar conta
        </Link>
      </div>
    </form>
  );
}

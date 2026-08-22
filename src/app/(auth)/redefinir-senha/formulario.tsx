"use client";

import { useActionState } from "react";

import { redefinirSenha, type EstadoFormulario } from "../actions";
import { Alerta } from "@/components/ui/alerta";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";

export function FormularioRedefinirSenha() {
  const [estado, acao] = useActionState<EstadoFormulario, FormData>(redefinirSenha, {});

  return (
    <form action={acao} className="flex flex-col gap-4">
      {estado.erro ? <Alerta tom="erro">{estado.erro}</Alerta> : null}

      <Campo
        rotulo="Nova senha"
        name="senha"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        ajuda="Pelo menos 8 caracteres."
        autoFocus
      />
      <Campo
        rotulo="Repita a nova senha"
        name="confirmacao"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
      />

      <Botao type="submit" carregandoTexto="Salvando...">
        Salvar nova senha
      </Botao>
    </form>
  );
}

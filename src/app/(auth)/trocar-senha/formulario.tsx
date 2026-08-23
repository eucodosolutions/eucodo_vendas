"use client";

import { useActionState } from "react";

import { trocarSenhaProvisoria, type EstadoFormulario } from "../actions";
import { useAviso } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";

export function FormularioTrocarSenha() {
  const [estado, acao] = useActionState<EstadoFormulario, FormData>(trocarSenhaProvisoria, {});
  useAviso(estado);

  return (
    <form action={acao} className="flex flex-col gap-4">
      <Campo
        rotulo="Nova senha"
        name="senha"
        type="password"
        placeholder="Pelo menos 8 caracteres"
        autoComplete="new-password"
        required
        minLength={8}
        autoFocus
      />
      <Campo
        rotulo="Repita a nova senha"
        name="confirmacao"
        type="password"
        placeholder="Digite a senha de novo"
        autoComplete="new-password"
        required
        minLength={8}
      />

      <Botao type="submit" carregandoTexto="Salvando..." larguraTotal>
        Salvar e entrar
      </Botao>
    </form>
  );
}

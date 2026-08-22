"use client";

import { useActionState } from "react";

import { redefinirSenha, type EstadoFormulario } from "../actions";
import { useAviso } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";

export function FormularioRedefinirSenha() {
  const [estado, acao] = useActionState<EstadoFormulario, FormData>(redefinirSenha, {});
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
        ajuda="Pelo menos 8 caracteres."
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
        Salvar nova senha
      </Botao>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useActionState } from "react";

import { criarConta, type EstadoFormulario } from "../actions";
import { useAviso } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { CampoWhatsapp } from "@/components/ui/campo-whatsapp";

export function FormularioCriarConta() {
  const [estado, acao] = useActionState<EstadoFormulario, FormData>(criarConta, {});
  useAviso(estado);

  // O aviso de que deu certo sai no toast, como em todo o sistema. O que fica
  // na tela e so o estado novo: o formulario ja foi, resta esperar a liberacao.
  if (estado.sucesso) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-tinta-suave">{estado.sucesso}</p>
        <Link href="/entrar" className="text-sm font-medium text-marca hover:underline">
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <form action={acao} className="flex flex-col gap-4">
      <Campo
        rotulo="Seu nome"
        name="nome"
        placeholder="Joel Bernardo"
        autoComplete="name"
        required
        autoFocus
      />
      <Campo
        rotulo="Nome do seu negócio"
        name="negocio"
        placeholder="Eucodo Solutions"
        autoComplete="organization"
        required
        ajuda="É o nome da sua conta no sistema, e o que sua equipe vê no painel."
      />
      <Campo
        rotulo="E-mail"
        name="email"
        type="email"
        placeholder="voce@empresa.com.br"
        autoComplete="email"
        inputMode="email"
        required
      />
      <CampoWhatsapp required />
      <Campo
        rotulo="Senha"
        name="senha"
        type="password"
        placeholder="Pelo menos 8 caracteres"
        autoComplete="new-password"
        required
        minLength={8}
      />

      <Botao type="submit" carregandoTexto="Criando..." larguraTotal>
        Criar conta
      </Botao>

      <p className="text-sm text-tinta-suave">
        Já tem acesso?{" "}
        <Link href="/entrar" className="font-medium text-marca hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}

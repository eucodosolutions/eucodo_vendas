import type { Metadata } from "next";

import { FormularioEsqueciSenha } from "./formulario";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default function PaginaEsqueciSenha() {
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-tinta">Esqueci minha senha</h1>
      <p className="mt-1 mb-6 text-sm text-tinta-suave">
        Digite seu e-mail e eu mando um link para você criar uma nova senha.
      </p>
      <FormularioEsqueciSenha />
    </>
  );
}

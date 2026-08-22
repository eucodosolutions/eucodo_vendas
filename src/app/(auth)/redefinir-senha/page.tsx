import type { Metadata } from "next";

import { FormularioRedefinirSenha } from "./formulario";

export const metadata: Metadata = { title: "Nova senha" };

export default function PaginaRedefinirSenha() {
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-tinta">Criar nova senha</h1>
      <p className="mt-1 mb-6 text-sm text-tinta-suave">
        Escolha uma senha nova. Ela passa a valer no próximo acesso.
      </p>
      <FormularioRedefinirSenha />
    </>
  );
}

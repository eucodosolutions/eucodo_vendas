import type { Metadata } from "next";

import { FormularioCriarConta } from "./formulario";

export const metadata: Metadata = { title: "Criar conta" };

export default function PaginaCriarConta() {
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-tinta">Criar conta</h1>
      <p className="mt-1 mb-6 text-sm text-tinta-suave">
        A conta e criada na hora, mas o acesso ao painel so abre depois que um
        administrador liberar.
      </p>
      <FormularioCriarConta />
    </>
  );
}

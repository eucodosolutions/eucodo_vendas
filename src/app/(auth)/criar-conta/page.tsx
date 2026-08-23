import type { Metadata } from "next";

import { FormularioCriarConta } from "./formulario";

export const metadata: Metadata = { title: "Criar conta" };

export default function PaginaCriarConta() {
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-tinta">Criar conta</h1>
      <p className="mt-1 mb-6 text-sm text-tinta-suave">
        Você cria a conta do seu negócio agora. O painel abre assim que a Eucodo
        liberar a assinatura.
      </p>
      <FormularioCriarConta />
    </>
  );
}

import type { Metadata } from "next";

import { FormularioEntrar } from "./formulario";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaEntrar({ searchParams }: PageProps<"/entrar">) {
  const { proxima } = await searchParams;

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-tinta">Entrar</h1>
      <p className="mt-1 mb-6 text-sm text-tinta-suave">
        Acesse o painel para fechar pedidos e acompanhar a produção.
      </p>
      <FormularioEntrar proxima={typeof proxima === "string" ? proxima : undefined} />
    </>
  );
}

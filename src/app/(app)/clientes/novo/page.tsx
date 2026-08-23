import type { Metadata } from "next";
import Link from "next/link";

import { FormularioCliente } from "../formulario-cliente";

export const metadata: Metadata = { title: "Novo cliente" };

export default function PaginaNovoCliente() {
  return (
    <div className="flex flex-col gap-5">
      <Link href="/clientes" className="text-sm font-medium text-marca hover:underline">
        Voltar para os clientes
      </Link>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-tinta">Novo cliente</h1>
        <p className="mt-1 text-sm text-tinta-suave">
          Nome e WhatsApp bastam. O resto dá para completar depois.
        </p>
      </header>

      <FormularioCliente />
    </div>
  );
}

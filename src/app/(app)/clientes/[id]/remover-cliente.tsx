"use client";

import { Trash2 } from "lucide-react";
import { useActionState } from "react";

import { removerCliente, type EstadoCliente } from "../actions";
import { useAviso } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";

export function RemoverCliente({ id, nome }: { id: string; nome: string }) {
  const [estado, acao] = useActionState<EstadoCliente, FormData>(removerCliente, {});
  useAviso(estado);

  return (
    <form
      action={acao}
      onSubmit={(evento) => {
        // Remocao nao tem desfazer, e a lista de clientes e o historico de quem
        // ja comprou. Uma pergunta antes custa menos que a recuperacao depois.
        if (!confirm(`Remover ${nome} da sua lista de clientes?`)) evento.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Botao type="submit" variante="secundario" carregandoTexto="Removendo...">
        <Trash2 size={16} aria-hidden />
        Remover cliente
      </Botao>
    </form>
  );
}

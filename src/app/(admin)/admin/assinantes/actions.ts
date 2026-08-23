"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { StatusAssinatura } from "@/types/database";

export type EstadoAssinatura = { erro?: string; sucesso?: string };

const esquema = z.object({
  assinaturaId: z.string().uuid(),
  status: z.enum(["pendente", "ativa", "suspensa", "cancelada"]),
});

const CONSEQUENCIA: Record<StatusAssinatura, string> = {
  ativa: "liberada. O assinante e a equipe dele já entram.",
  pendente: "voltou para a espera. Ninguém da conta entra até você liberar.",
  suspensa: "suspensa. O acesso da conta inteira parou agora.",
  cancelada: "cancelada. A conta some do uso, mas os dados continuam no banco.",
};

/**
 * Muda o status de uma assinatura.
 *
 * E o unico botao do admin sobre a conta de outra pessoa, e por isso o unico
 * lugar do sistema onde `usuario_admin()` autoriza escrita. Suspender derruba a
 * equipe junto: `usuario_ativo()` exige assinatura ativa.
 */
export async function mudarStatusDaAssinatura(
  _estado: EstadoAssinatura,
  dados: FormData,
): Promise<EstadoAssinatura> {
  const resultado = esquema.safeParse({
    assinaturaId: dados.get("assinaturaId"),
    status: dados.get("status"),
  });

  if (!resultado.success) return { erro: "Status inválido." };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("assinaturas")
    .update({ status: resultado.data.status })
    .eq("id", resultado.data.assinaturaId)
    .select("nome")
    .single();

  if (error || !data) return { erro: "Não consegui mudar o status desta conta." };

  revalidatePath("/admin");
  revalidatePath("/admin/assinantes");

  return { sucesso: `${data.nome} ${CONSEQUENCIA[resultado.data.status]}` };
}

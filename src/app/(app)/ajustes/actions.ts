"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { contaDoDono } from "@/lib/supabase/dono";
import { createClient } from "@/lib/supabase/server";

export type EstadoAjustes = { erro?: string; sucesso?: string };

const esquemaConfiguracoes = z.object({
  pixChave: z.string().trim().max(200).optional(),
  pixBeneficiario: z.string().trim().max(60).optional(),
  pixCidade: z.string().trim().max(60).optional(),
});

export async function salvarConfiguracoes(
  _estado: EstadoAjustes,
  dados: FormData,
): Promise<EstadoAjustes> {
  const resultado = esquemaConfiguracoes.safeParse({
    pixChave: dados.get("pixChave") || undefined,
    pixBeneficiario: dados.get("pixBeneficiario") || undefined,
    pixCidade: dados.get("pixCidade") || undefined,
  });

  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Confira os dados." };
  }

  const assinaturaId = await contaDoDono();
  if (!assinaturaId) return { erro: "Só o dono da conta mexe em Ajustes." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("configuracoes")
    .update({
      pix_chave: resultado.data.pixChave || null,
      pix_beneficiario: resultado.data.pixBeneficiario || null,
      pix_cidade: resultado.data.pixCidade || null,
    })
    .eq("assinatura_id", assinaturaId);

  if (error) return { erro: "Não consegui salvar as configurações." };

  revalidatePath("/ajustes");
  return { sucesso: "Configurações salvas." };
}

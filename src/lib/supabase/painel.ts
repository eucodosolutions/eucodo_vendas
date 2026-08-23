import "server-only";

import { createClient } from "./server";
import type { Assinatura, Perfil } from "@/types/database";

export type PerfilDoPainel = Pick<
  Perfil,
  | "id"
  | "nome"
  | "email"
  | "papel"
  | "status"
  | "assinatura_id"
  | "senha_temporaria"
>;

export type ContaDoPainel = Pick<Assinatura, "id" | "nome" | "status">;

export type SessaoDoPainel = {
  perfil: PerfilDoPainel;
  /** Nulo no admin da plataforma, que nao pertence a conta nenhuma. */
  conta: ContaDoPainel | null;
};

const CAMPOS =
  "id, nome, email, papel, status, assinatura_id, senha_temporaria, assinaturas (id, nome, status)";

type LinhaPerfil = PerfilDoPainel & { assinaturas: ContaDoPainel | null };

/**
 * Quem esta logado, com a conta dele, numa consulta so.
 *
 * Layout e paginas precisam das mesmas tres coisas (papel, status do perfil,
 * status da conta) para decidir o que mostrar. Repetir esse select em cada
 * arquivo seria repetir tambem a chance de esquecer uma das tres.
 */
export async function sessaoDoPainel(): Promise<SessaoDoPainel | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("perfis")
    .select(CAMPOS)
    .eq("id", user.id)
    .single<LinhaPerfil>();

  if (!data) return null;

  const { assinaturas, ...perfil } = data;
  return { perfil, conta: assinaturas };
}

/** Motivo pelo qual o painel nao abre, no formato que `/entrar` sabe traduzir. */
export function motivoDoBloqueio(sessao: SessaoDoPainel): string | null {
  const { perfil, conta } = sessao;

  if (perfil.status === "bloqueado") return "acesso_bloqueado";
  if (perfil.status !== "ativo") return "acesso_pendente";

  // O admin da plataforma nao tem conta, e nao deveria estar aqui de qualquer jeito.
  if (perfil.papel === "admin") return null;

  if (!conta) return "acesso_pendente";
  if (conta.status === "pendente") return "conta_pendente";
  if (conta.status === "suspensa") return "conta_suspensa";
  if (conta.status === "cancelada") return "conta_cancelada";

  return null;
}

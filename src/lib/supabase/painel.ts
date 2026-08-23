import "server-only";

import { createClient } from "./server";
import type { Assinatura, Perfil } from "@/types/database";

export type PerfilDoPainel = Pick<
  Perfil,
  "id" | "nome" | "email" | "papel" | "ativo" | "assinatura_id" | "senha_temporaria"
>;

export type ContaDoPainel = Pick<Assinatura, "id" | "nome" | "status">;

export type SessaoDoPainel = {
  perfil: PerfilDoPainel;
  /** Nulo no admin da plataforma, que nao pertence a conta nenhuma. */
  conta: ContaDoPainel | null;
};

const CAMPOS =
  "id, nome, email, papel, ativo, assinatura_id, senha_temporaria, assinaturas (id, nome, status)";

type LinhaPerfil = PerfilDoPainel & { assinaturas: ContaDoPainel | null };

/**
 * Quem esta logado, com a conta dele, numa consulta so.
 *
 * Layout, paginas e a action de login precisam das mesmas tres coisas (papel,
 * bloqueio da pessoa, status da conta) para decidir o que mostrar. Repetir esse
 * select em cada arquivo seria repetir tambem a chance de esquecer uma das tres.
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

/**
 * Motivo pelo qual o painel nao abre, no formato que `/entrar` sabe traduzir.
 *
 * A regra mora so aqui. O login chamava esta funcao ate ela ganhar uma copia
 * propria dentro da action, e as duas copias passaram a dar respostas
 * diferentes para a mesma conta: a pessoa lia "seu acesso nao foi liberado"
 * quando o que faltava era a assinatura.
 */
export function motivoDoBloqueio(sessao: SessaoDoPainel): string | null {
  const { perfil, conta } = sessao;

  if (!perfil.ativo) return "acesso_bloqueado";

  // O admin da plataforma nao tem conta, e nao deveria estar aqui de qualquer jeito.
  if (perfil.papel === "admin") return null;

  // Sem conta o perfil esta pela metade, o que so acontece se um cadastro
  // quebrou no meio. Trata como bloqueio para nao abrir painel sem catalogo.
  if (!conta) return "acesso_bloqueado";
  if (conta.status !== "ativa") return `conta_${conta.status}`;

  return null;
}

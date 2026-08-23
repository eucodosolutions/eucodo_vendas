"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { validarLinkAvaliacao } from "@/lib/formato";
import { sessaoDoPainel } from "@/lib/supabase/painel";
import { createClient } from "@/lib/supabase/server";

export type EstadoNegocio = {
  erro?: string;
  sucesso?: string;
  /** Preenchido no cadastro, para quem chamou saber com qual negocio seguir. */
  negocioId?: string;
};

// A ordem dos campos e a ordem dos avisos: `issues[0]` e o primeiro que falhou.
// O link vem antes do nome porque, sem negocio escolhido, o campo de nome nem
// esta na tela — cobrar o nome ali mandaria a pessoa preencher o que nao ve.
const esquema = z.object({
  id: z.string().uuid().optional(),
  linkAvaliacao: z.string().trim().min(1, "Encontre o negócio no Google ou cole o link dele."),
  nome: z.string().trim().min(2, "Digite o nome do negócio."),
  placeId: z.string().trim().optional(),
  endereco: z.string().trim().max(300).optional(),
  observacoes: z.string().trim().max(500).optional(),
});

type DadosDoNegocio = z.infer<typeof esquema>;

/**
 * Cadastra ou atualiza um negocio.
 *
 * Quem pode o que fica na RLS, e nao em `if` aqui: a policy deixa o dono da
 * conta e quem cadastrou mexerem na linha, entao chamar esta acao por fora da
 * tela nao alcanca o negocio de outra pessoa da equipe.
 */
export async function salvarNegocio(
  _estado: EstadoNegocio,
  dados: FormData,
): Promise<EstadoNegocio> {
  const resultado = esquema.safeParse({
    id: dados.get("id") || undefined,
    // `?? ""` e nao o valor cru: o campo de nome so existe depois de o negocio
    // ser escolhido, e um `null` chegando ao zod troca o aviso escrito para
    // "expected string, received null".
    linkAvaliacao: dados.get("linkAvaliacao") ?? "",
    nome: dados.get("nome") ?? "",
    placeId: dados.get("placeId") || undefined,
    endereco: dados.get("endereco") || undefined,
    observacoes: dados.get("observacoes") || undefined,
  });

  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Confira os dados do negócio." };
  }

  return await gravar(resultado.data);
}

/**
 * Devolve o negocio deste link, cadastrando-o se ainda nao existir.
 *
 * E por aqui que passa a venda: adicionar uma placa por pesquisa ou por link
 * colado cria o negocio na hora, sem um segundo cadastro a mao. Idempotente de
 * proposito — a mesma placa vendida tres vezes nao vira tres linhas na agenda.
 *
 * Quando o negocio ja existe, o que esta gravado fica como esta. O nome do
 * cadastro e o que a pessoa escolheu para a agenda dela; o nome que vai
 * impresso e outro campo, carimbado no item da venda. Sobrescrever aqui deixaria
 * um ajuste de uma placa renomeando o negocio na lista de todo mundo.
 */
export async function garantirNegocio(dados: {
  nome: string;
  linkAvaliacao: string;
  placeId?: string;
  endereco?: string;
}): Promise<EstadoNegocio> {
  const resultado = esquema.safeParse(dados);
  if (!resultado.success) {
    return { erro: resultado.error.issues[0]?.message ?? "Confira os dados do negócio." };
  }

  const link = validarLinkAvaliacao(resultado.data.linkAvaliacao);
  if (!link) return { erro: "Este link não abre a caixa de avaliação." };

  const sessao = await sessaoDoPainel();
  if (!sessao?.perfil.assinatura_id) return { erro: "Sessão expirada. Entre de novo." };

  const supabase = await createClient();

  // A busca vem antes do insert, e nao um `upsert`: `on conflict` precisaria
  // nomear o indice unico, e a RLS ja limita esta consulta ao que e desta
  // pessoa, que e exatamente o escopo da unicidade.
  const { data: existente } = await supabase
    .from("negocios")
    .select("id")
    .eq("link_avaliacao", link)
    .eq("criado_por", sessao.perfil.id)
    .maybeSingle();

  if (existente) return { negocioId: existente.id };

  return await gravar({ ...resultado.data, linkAvaliacao: link });
}

async function gravar(dados: DadosDoNegocio): Promise<EstadoNegocio> {
  const link = validarLinkAvaliacao(dados.linkAvaliacao);
  if (!link) {
    return { erro: "Este link não abre a caixa de avaliação. Use o do painel do Google." };
  }

  const sessao = await sessaoDoPainel();
  if (!sessao?.perfil.assinatura_id) return { erro: "Sessão expirada. Entre de novo." };

  const supabase = await createClient();

  const campos = {
    nome: dados.nome,
    link_avaliacao: link,
    google_place_id: dados.placeId || null,
    endereco: dados.endereco || null,
    observacoes: dados.observacoes || null,
  };

  if (dados.id) {
    // O `select` nao e enfeite: quando a policy barra a linha, o update nao
    // levanta erro nenhum, so nao altera nada. Sem conferir o que voltou, o
    // vendedor tentando mexer no negocio de outro receberia "atualizado".
    const { data: alterado, error } = await supabase
      .from("negocios")
      .update(campos)
      .eq("id", dados.id)
      .select("id")
      .maybeSingle();

    if (error) return { erro: motivo(error, "Não consegui salvar as alterações.") };
    if (!alterado) return { erro: SO_QUEM_CADASTROU };

    revalidatePath("/negocios");
    revalidatePath(`/negocios/${dados.id}`);
    return { sucesso: `${dados.nome} atualizado.`, negocioId: dados.id };
  }

  const { data: criado, error } = await supabase
    .from("negocios")
    .insert({
      ...campos,
      assinatura_id: sessao.perfil.assinatura_id,
      criado_por: sessao.perfil.id,
    })
    .select("id")
    .single();

  if (error || !criado) return { erro: motivo(error, "Não consegui cadastrar o negócio.") };

  revalidatePath("/negocios");
  return { sucesso: `${dados.nome} cadastrado.`, negocioId: criado.id };
}

export async function removerNegocio(
  _estado: EstadoNegocio,
  dados: FormData,
): Promise<EstadoNegocio> {
  const id = String(dados.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success) return { erro: "Negócio inválido." };

  const supabase = await createClient();
  const { data: removido, error } = await supabase
    .from("negocios")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  // Sem o caso do 23503 que o cliente tem: o item do pedido aponta para o
  // negocio com ON DELETE SET NULL, e o que foi impresso continua carimbado no
  // proprio item. Tirar o negocio da agenda nao apaga historico de venda nenhum.
  if (error) return { erro: "Não consegui remover este negócio." };

  // Mesmo caso do update: linha barrada pela policy sai como zero linhas, e nao
  // como erro.
  if (!removido) return { erro: SO_QUEM_CADASTROU };

  revalidatePath("/negocios");
  return { sucesso: "Negócio removido." };
}

const SO_QUEM_CADASTROU =
  "Este negócio foi cadastrado por outra pessoa da equipe. Só quem cadastrou, ou o dono da conta, pode mexer nele.";

function motivo(error: { code?: string } | null, padrao: string): string {
  // A unicidade e por autor: o link repetido que o banco recusa e sempre um
  // negocio que a propria pessoa ja tem cadastrado. O do colega nao atrapalha.
  if (error?.code === "23505") return "Você já cadastrou este negócio.";
  if (error?.code === "42501") return SO_QUEM_CADASTROU;
  return padrao;
}

// Cadastro de vendedor do Eucodo Vendas.
//
// Criar usuario exige a chave de servico, e a regra da casa e que ela nunca
// saia do Supabase. Entao quem cria o vendedor e esta funcao: a aplicacao manda
// o JWT do assinante, e aqui se decide se ele pode.
//
// O vendedor nasce preso a conta de quem o criou. A assinatura viaja no
// metadata do usuario e e o gatilho `criar_perfil_do_usuario` que amarra o
// perfil a ela, na mesma transacao em que o usuario e criado.
//
// A senha provisoria nasce aqui e volta uma unica vez na resposta. Nao fica
// guardada em lugar nenhum: o dono copia, manda no WhatsApp, e o vendedor e
// obrigado a trocar no primeiro acesso.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { CABECALHOS_CORS, responder } from "../_shared/cors.ts";

type Corpo = {
  acao?: "criar" | "nova_senha";
  nome?: string;
  email?: string;
  whatsapp?: string;
  /** Só em nova_senha: de quem é a senha que vai ser trocada. */
  vendedorId?: string;
};

type Resultado = {
  id: string;
  nome: string;
  email: string;
  senha: string;
};

// Sem 0/O e sem 1/l/I: a senha vai ser lida na tela antes de ser copiada, e
// caractere ambiguo vira chamado de "nao consigo entrar".
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const TAMANHO_SENHA = 8;

function gerarSenha(): string {
  const sorteio = new Uint32Array(TAMANHO_SENHA);
  crypto.getRandomValues(sorteio);
  return Array.from(sorteio, (n) => ALFABETO[n % ALFABETO.length]).join("");
}

function normalizarWhatsapp(bruto: string): string | null {
  let digitos = bruto.replace(/\D/g, "");
  if (digitos.startsWith("0")) digitos = digitos.slice(1);
  if (!digitos.startsWith("55")) digitos = `55${digitos}`;
  return /^55[1-9][0-9]9[0-9]{8}$/.test(digitos) ? digitos : null;
}

Deno.serve(async (requisicao) => {
  if (requisicao.method === "OPTIONS") {
    return new Response("ok", { headers: CABECALHOS_CORS });
  }

  if (requisicao.method !== "POST") {
    return responder({ erro: "Use POST." }, 405);
  }

  const jwt = (requisicao.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return responder({ erro: "Sem credencial." }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser(jwt);
  if (!user) return responder({ erro: "Credencial inválida." }, 401);

  const { data: dono } = await supabase
    .from("perfis")
    .select("id, papel, ativo, assinatura_id, assinaturas (status)")
    .eq("id", user.id)
    .single();

  if (!dono || !dono.ativo || dono.papel !== "assinante" || !dono.assinatura_id) {
    return responder({ erro: "Só o dono da conta cadastra vendedor." }, 403);
  }

  if (dono.assinaturas?.status !== "ativa") {
    return responder({ erro: "Esta conta não está ativa." }, 403);
  }

  let corpo: Corpo;
  try {
    corpo = await requisicao.json();
  } catch {
    return responder({ erro: "Corpo inválido." }, 400);
  }

  if (corpo.acao === "nova_senha") {
    return await gerarNovaSenha(supabase, dono.assinatura_id, corpo.vendedorId ?? "");
  }

  return await criarVendedor(supabase, dono.assinatura_id, corpo);
});

async function criarVendedor(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  assinaturaId: string,
  corpo: Corpo,
): Promise<Response> {
  const nome = (corpo.nome ?? "").trim();
  const email = (corpo.email ?? "").trim().toLowerCase();

  if (nome.length < 2) return responder({ erro: "Digite o nome do vendedor." }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return responder({ erro: "Confira o e-mail do vendedor." }, 400);
  }

  const whatsapp = normalizarWhatsapp(corpo.whatsapp ?? "");
  if (!whatsapp) {
    return responder({ erro: "Esse WhatsApp não parece válido. Confira o DDD." }, 400);
  }

  const senha = gerarSenha();

  const { data: criado, error: erroCriacao } = await supabase.auth.admin.createUser({
    email,
    password: senha,
    // Sem confirmacao por e-mail: quem responde pelo acesso e o dono da conta,
    // que acabou de digitar os dados com o vendedor do lado.
    email_confirm: true,
    user_metadata: { nome, whatsapp, papel: "vendedor", assinatura_id: assinaturaId },
  });

  if (erroCriacao || !criado?.user) {
    const jaExiste = String(erroCriacao?.message ?? "").toLowerCase().includes("already");
    return responder(
      { erro: jaExiste ? "Já existe uma conta com esse e-mail." : "Não consegui criar o acesso." },
      jaExiste ? 409 : 500,
    );
  }

  // O gatilho do banco ja criou o perfil vendedor, ja preso a conta. Falta
  // marcar que a senha e provisoria: a comissao nao mora mais aqui, e sim no
  // produto que ele vender.
  const { error: erroPerfil } = await supabase
    .from("perfis")
    .update({ senha_temporaria: true })
    .eq("id", criado.user.id);

  if (erroPerfil) {
    // Perfil pela metade e pior que vendedor nenhum: desfaz o usuario para o
    // dono poder tentar de novo com o mesmo e-mail.
    await supabase.auth.admin.deleteUser(criado.user.id);
    return responder({ erro: "Não consegui vincular o vendedor. Tente de novo." }, 500);
  }

  return responder<Resultado>({ id: criado.user.id, nome, email, senha });
}

async function gerarNovaSenha(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  assinaturaId: string,
  vendedorId: string,
): Promise<Response> {
  if (!vendedorId) return responder({ erro: "Informe o vendedor." }, 400);

  const { data: vendedor } = await supabase
    .from("perfis")
    .select("id, nome, email, papel, assinatura_id")
    .eq("id", vendedorId)
    .single();

  if (!vendedor || vendedor.papel !== "vendedor" || vendedor.assinatura_id !== assinaturaId) {
    return responder({ erro: "Esse vendedor não é da sua equipe." }, 403);
  }

  const senha = gerarSenha();

  const { error } = await supabase.auth.admin.updateUserById(vendedor.id, { password: senha });
  if (error) return responder({ erro: "Não consegui trocar a senha." }, 500);

  await supabase.from("perfis").update({ senha_temporaria: true }).eq("id", vendedor.id);

  return responder<Resultado>({
    id: vendedor.id,
    nome: vendedor.nome,
    email: vendedor.email,
    senha,
  });
}

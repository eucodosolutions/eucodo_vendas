// Conexao do WhatsApp da conta, vista de Ajustes.
//
// A instancia e fornecida pela plataforma: o assinante nao tem conta na uazapi
// e nunca ve token nenhum. Ele clica em "Conectar", esta funcao cria a
// instancia no servidor com o admintoken da Eucodo, guarda o token no Vault e
// devolve o QR code para ele escanear com o celular.
//
// Tres acoes, e todas passam por aqui pelo mesmo motivo do envio: o admintoken
// abre o servidor inteiro, entao ele nao chega nem perto do navegador. Quem
// decide o que a conta pode fazer com a propria instancia e este codigo.
//
// A tela pergunta o status de tempos em tempos enquanto o QR esta na frente do
// assinante, porque o pareamento acontece no celular dele: nao ha nada que a
// uazapi mande de volta para o painel avisando que deu certo.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { CABECALHOS_CORS, responder } from "../_shared/cors.ts";

type Acao = "status" | "conectar" | "desconectar";

type Corpo = {
  acao?: Acao;
  /** Numero para receber codigo de pareamento em vez de QR code. */
  telefone?: string;
};

/**
 * Os quatro estados da uazapi, mais o nosso: `sem_instancia` e a conta que
 * ainda nao pediu para conectar, e e o unico que a tela trata como comeco.
 */
type Estado = "sem_instancia" | "desconectado" | "conectando" | "conectado" | "hibernado";

type Conexao = {
  estado: Estado;
  /** Numero pareado, so quando conectado. */
  numero?: string | null;
  perfil?: string | null;
  /** Imagem pronta para <img src>, no formato data:image/png;base64. */
  qrcode?: string | null;
  paircode?: string | null;
};

/** Instancia da conta, ja com o token em claro. So existe dentro daqui. */
type Instancia = { id: string; host: string; token: string };

const TEMPO_LIMITE = 20000;

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

  // Aqui roda a chave de servico, que passa por cima do RLS: a policy que
  // deixaria so o dono da conta ver isto precisa ser repetida na mao.
  const { data: dono } = await supabase
    .from("perfis")
    .select("papel, ativo, assinatura_id, assinaturas (nome, status)")
    .eq("id", user.id)
    .single();

  if (!dono?.ativo || dono.papel !== "assinante" || !dono.assinatura_id) {
    return responder({ erro: "Só o dono da conta conecta o WhatsApp." }, 403);
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

  const assinaturaId = dono.assinatura_id as string;
  const nomeDaConta = (dono.assinaturas?.nome as string) ?? "conta";

  try {
    switch (corpo.acao) {
      case "conectar":
        return await conectar(supabase, assinaturaId, nomeDaConta, corpo.telefone);
      case "desconectar":
        return await desconectar(supabase, assinaturaId);
      case "status":
      case undefined:
        return await status(supabase, assinaturaId);
      default:
        return responder({ erro: "Ação desconhecida." }, 400);
    }
  } catch (erro) {
    console.error("whatsapp-instancia:", erro);
    return responder({ erro: "O servidor de WhatsApp não respondeu." }, 502);
  }
});

// ---------------------------------------------------------------------------
// Acoes
// ---------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
async function status(supabase: any, assinaturaId: string): Promise<Response> {
  const instancia = await instanciaDaConta(supabase, assinaturaId);
  if (!instancia) return responder<Conexao>({ estado: "sem_instancia" });

  const resposta = await chamar(instancia.host, "/instance/status", {
    token: instancia.token,
  });

  // Token que nao abre mais nada: a instancia sumiu do lado da uazapi, e o
  // cadastro daqui virou lixo. Some com ele para o assinante poder conectar de
  // novo, em vez de bater para sempre numa instancia que nao existe.
  if (resposta.status === 401 || resposta.status === 404) {
    await esquecer(supabase, instancia.id, assinaturaId);
    return responder<Conexao>({ estado: "sem_instancia" });
  }

  if (!resposta.ok) return responder({ erro: "Não consegui falar com o WhatsApp." }, 502);

  return responder<Conexao>(lerConexao(resposta.dados));
}

async function conectar(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  assinaturaId: string,
  nomeDaConta: string,
  telefone?: string,
): Promise<Response> {
  let instancia = await instanciaDaConta(supabase, assinaturaId);

  if (!instancia) {
    const criada = await criarInstancia(supabase, assinaturaId, nomeDaConta);
    if ("erro" in criada) return responder({ erro: criada.erro }, criada.status);
    instancia = criada.instancia;
  }

  // Sem `phone` a uazapi devolve QR code; com ele, um codigo de pareamento,
  // que e o caminho de quem vai conectar pelo proprio celular e nao tem uma
  // segunda tela para apontar a camera.
  const numero = (telefone ?? "").replace(/\D/g, "");
  const resposta = await chamar(
    instancia.host,
    "/instance/connect",
    { token: instancia.token },
    numero ? { phone: numero } : {},
  );

  if (resposta.status === 401 || resposta.status === 404) {
    await esquecer(supabase, instancia.id, assinaturaId);
    return responder({ erro: "A instância caiu. Tente conectar de novo." }, 409);
  }

  if (!resposta.ok) {
    // 429 e o limite de instancias conectadas do plano, e e a falha que mais
    // vai aparecer quando a plataforma crescer. Vale dizer o nome dela.
    const motivo = resposta.status === 429
      ? "O servidor de WhatsApp está no limite de conexões."
      : "Não consegui iniciar a conexão.";
    return responder({ erro: motivo }, 502);
  }

  const conexao = lerConexao(resposta.dados);

  // O QR as vezes ainda nao esta pronto na resposta do `/connect`. Uma consulta
  // de status resolve, e evita mandar a tela abrir um quadrado vazio.
  if (!conexao.qrcode && !conexao.paircode && conexao.estado === "conectando") {
    const conferida = await chamar(instancia.host, "/instance/status", {
      token: instancia.token,
    });
    if (conferida.ok) return responder<Conexao>(lerConexao(conferida.dados));
  }

  return responder<Conexao>(conexao);
}

// deno-lint-ignore no-explicit-any
async function desconectar(supabase: any, assinaturaId: string): Promise<Response> {
  const instancia = await instanciaDaConta(supabase, assinaturaId);
  if (!instancia) return responder<Conexao>({ estado: "sem_instancia" });

  const resposta = await chamar(
    instancia.host,
    "/instance/disconnect",
    { token: instancia.token },
    {},
  );

  if (resposta.status === 401 || resposta.status === 404) {
    await esquecer(supabase, instancia.id, assinaturaId);
    return responder<Conexao>({ estado: "sem_instancia" });
  }

  if (!resposta.ok) return responder({ erro: "Não consegui desconectar." }, 502);

  // A instancia continua de pe, so sem aparelho pareado: reconectar e escanear
  // outro QR, sem criar instancia nova nem gastar outra vaga do plano.
  return responder<Conexao>({ estado: "desconectado" });
}

// ---------------------------------------------------------------------------
// Instancia da conta
// ---------------------------------------------------------------------------

/**
 * A instancia desta conta, com o token decifrado.
 *
 * Procura pelo `instancia_id` da configuracao, e nao por qualquer instancia
 * ativa: a versao antiga desta busca caia em "a primeira que achar", o que numa
 * instalacao com varios assinantes mandaria a mensagem de um pelo WhatsApp de
 * outro.
 */
async function instanciaDaConta(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  assinaturaId: string,
): Promise<Instancia | null> {
  const { data: config } = await supabase
    .from("configuracoes")
    .select("instancia_id")
    .eq("assinatura_id", assinaturaId)
    .single();

  if (!config?.instancia_id) return null;

  const { data: cadastro } = await supabase
    .from("instancias_whatsapp")
    .select("id, host")
    .eq("id", config.instancia_id)
    .eq("ativo", true)
    .maybeSingle();

  if (!cadastro) return null;

  const { data: token } = await supabase.rpc("token_da_instancia", {
    p_instancia_id: cadastro.id,
  });

  if (!token) return null;
  return { id: cadastro.id as string, host: cadastro.host as string, token: token as string };
}

/**
 * Cria a instancia no servidor uazapi e amarra a conta.
 *
 * A ordem importa: primeiro a uazapi, que e quem pode recusar, e so depois o
 * banco. Se fosse ao contrario, um 429 do servidor deixaria uma instancia
 * cadastrada aqui com um token que nunca existiu.
 */
async function criarInstancia(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  assinaturaId: string,
  nomeDaConta: string,
): Promise<{ instancia: Instancia } | { erro: string; status: number }> {
  const host = (Deno.env.get("UAZAPI_HOST") ?? "").replace(/\/$/, "");
  const admintoken = Deno.env.get("UAZAPI_ADMIN_TOKEN") ?? "";

  if (!host || !admintoken) {
    return { erro: "O servidor de WhatsApp ainda não foi configurado.", status: 503 };
  }

  const nome = apelidoDaInstancia(nomeDaConta, assinaturaId);

  const resposta = await chamar(host, "/instance/create", { admintoken }, {
    name: nome,
    // O id da conta viaja junto para o painel da uazapi dizer de quem e cada
    // instancia. Sem isso, uma lista de instancias e uma lista de apelidos.
    adminField01: assinaturaId,
  });

  if (!resposta.ok) {
    const motivo = resposta.status === 429
      ? "O servidor de WhatsApp está no limite de instâncias."
      : "Não consegui criar a instância.";
    return { erro: motivo, status: 502 };
  }

  const dados = (resposta.dados ?? {}) as {
    token?: string;
    instance?: { id?: string };
  };

  const token = dados.token;
  if (!token) return { erro: "A instância veio sem token.", status: 502 };

  const { data: instanciaId, error } = await supabase.rpc("registrar_instancia_whatsapp", {
    p_rotulo: nomeDaConta,
    p_host: host,
    p_token: token,
    p_observacao: "Criada pelo painel, em Ajustes",
    p_assinatura_id: assinaturaId,
    p_id_remoto: dados.instance?.id ?? null,
  });

  if (error || !instanciaId) {
    console.error("registrar_instancia_whatsapp:", error);
    return { erro: "Não consegui guardar a instância.", status: 500 };
  }

  await supabase
    .from("configuracoes")
    .update({ instancia_id: instanciaId })
    .eq("assinatura_id", assinaturaId);

  return { instancia: { id: instanciaId as string, host, token } };
}

/** Apaga o cadastro da instancia e solta a conta dela. */
// deno-lint-ignore no-explicit-any
async function esquecer(supabase: any, instanciaId: string, assinaturaId: string) {
  await supabase
    .from("configuracoes")
    .update({ instancia_id: null })
    .eq("assinatura_id", assinaturaId);

  await supabase.rpc("esquecer_instancia_whatsapp", { p_instancia_id: instanciaId });
}

/**
 * Nome da instancia no painel da uazapi.
 *
 * Leva o nome da conta para ser reconhecivel de relance, e um pedaco do id
 * porque dois assinantes chamados "Eucodo" existem e a uazapi nao tem por que
 * saber disso.
 */
function apelidoDaInstancia(nomeDaConta: string, assinaturaId: string): string {
  const limpo = nomeDaConta
    .normalize("NFD")
    // Separado o acento da letra pelo NFD, `\p{M}` leva so o acento embora:
    // "São" vira "sao", e nao "sa-o" como faria a limpeza logo abaixo.
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);

  return `${limpo || "conta"}-${assinaturaId.slice(0, 8)}`;
}

// ---------------------------------------------------------------------------
// uazapi
// ---------------------------------------------------------------------------

/** GET quando nao ha corpo, POST quando ha. E o padrao da API deles. */
async function chamar(
  host: string,
  rota: string,
  cabecalhos: Record<string, string>,
  corpo?: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; dados: unknown }> {
  const resposta = await fetch(`${host.replace(/\/$/, "")}${rota}`, {
    method: corpo ? "POST" : "GET",
    headers: { ...cabecalhos, ...(corpo ? { "Content-Type": "application/json" } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal: AbortSignal.timeout(TEMPO_LIMITE),
  });

  const dados = await resposta.json().catch(() => null);
  return { ok: resposta.ok, status: resposta.status, dados };
}

/**
 * Traduz a resposta da uazapi para o que a tela entende.
 *
 * `/connect` e `/status` devolvem formatos parecidos mas nao iguais — o numero
 * pareado esta em `status.jid` num e em `jid` no outro — entao a leitura mora
 * num lugar so.
 */
function lerConexao(dados: unknown): Conexao {
  const corpo = (dados ?? {}) as {
    instance?: Record<string, unknown>;
    status?: { jid?: { user?: string } | null };
    jid?: { user?: string } | null;
  };

  const instancia = corpo.instance ?? {};
  const jid = corpo.status?.jid ?? corpo.jid ?? null;

  const bruto = String(instancia.status ?? "").toLowerCase();
  const estado: Estado = bruto === "connected"
    ? "conectado"
    : bruto === "connecting"
    ? "conectando"
    : bruto === "hibernated"
    ? "hibernado"
    : "desconectado";

  const numero = jid?.user ?? (typeof instancia.owner === "string" ? instancia.owner : null);

  return {
    estado,
    numero: estado === "conectado" ? (numero ?? null) : null,
    perfil: typeof instancia.profileName === "string" ? instancia.profileName : null,
    // QR e codigo de pareamento so valem enquanto a conexao esta em curso;
    // depois de conectado sao lixo que a tela nao deve mostrar.
    qrcode: estado === "conectando" && typeof instancia.qrcode === "string"
      ? instancia.qrcode
      : null,
    paircode: estado === "conectando" && typeof instancia.paircode === "string"
      ? instancia.paircode
      : null,
  };
}

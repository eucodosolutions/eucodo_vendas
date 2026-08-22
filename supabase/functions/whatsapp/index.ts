// Envio de WhatsApp do Eucodo Vendas.
//
// Esta funcao existe para o token da uazapi e a chave de servico nunca sairem
// do Supabase. A aplicacao chama daqui com o JWT do vendedor, e quem decide o
// que pode ser enviado e este codigo, nao o navegador.
//
// Quando nao ha instancia conectada (assinante sem instancia, ou que parou de
// pagar), o envio nao falha: a funcao devolve um link formatado do WhatsApp
// para o vendedor abrir e mandar na mao. A venda nunca fica refem da API.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { CABECALHOS_CORS, responder } from "../_shared/cors.ts";

type Corpo = {
  pedidoId: string;
  chave: string;
  /** Texto pronto, para quando o painel quiser mandar algo fora do modelo. */
  textoManual?: string;
  /** Manda so texto, sem a imagem da arte. */
  semArte?: boolean;
};

type Resultado = {
  enviado: boolean;
  via: "uazapi" | "link";
  link?: string;
  texto: string;
  erro?: string;
};

const UMA_HORA = 3600;

Deno.serve(async (requisicao) => {
  if (requisicao.method === "OPTIONS") {
    return new Response("ok", { headers: CABECALHOS_CORS });
  }

  if (requisicao.method !== "POST") {
    return responder({ erro: "Use POST." }, 405);
  }

  const autorizacao = requisicao.headers.get("Authorization") ?? "";
  const jwt = autorizacao.replace(/^Bearer\s+/i, "");
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

  const { data: perfil } = await supabase
    .from("perfis")
    .select("status")
    .eq("id", user.id)
    .single();

  if (perfil?.status !== "ativo") {
    return responder({ erro: "Acesso não liberado." }, 403);
  }

  let corpo: Corpo;
  try {
    corpo = await requisicao.json();
  } catch {
    return responder({ erro: "Corpo inválido." }, 400);
  }

  if (!corpo.pedidoId || (!corpo.chave && !corpo.textoManual)) {
    return responder({ erro: "Informe o pedido e o modelo da mensagem." }, 400);
  }

  const { data: pedido } = await supabase
    .from("pedidos")
    .select(
      "id, codigo, nome_negocio, whatsapp, tamanho_codigo, cor, tecnologia, quantidade, total_centavos, arte_preview_path",
    )
    .eq("id", corpo.pedidoId)
    .single();

  if (!pedido) return responder({ erro: "Pedido não encontrado." }, 404);

  const texto = corpo.textoManual ?? (await montarTexto(supabase, corpo.chave, pedido));
  if (!texto) return responder({ erro: "Modelo de mensagem não encontrado." }, 404);

  const instancia = await instanciaAtiva(supabase);
  const linkManual = montarLinkWhatsapp(pedido.whatsapp, texto);

  if (!instancia) {
    await registrar(supabase, {
      pedidoId: pedido.id,
      destino: pedido.whatsapp,
      chave: corpo.chave,
      texto,
      temMidia: false,
      via: "link",
      sucesso: false,
      erro: "Sem instância conectada, enviado por link",
    });

    return responder<Resultado>({ enviado: false, via: "link", link: linkManual, texto });
  }

  const urlDaArte =
    corpo.semArte || !pedido.arte_preview_path
      ? null
      : (
          await supabase.storage
            .from("artes")
            .createSignedUrl(pedido.arte_preview_path, UMA_HORA)
        ).data?.signedUrl ?? null;

  const envio = await enviarPelaUazapi({
    host: instancia.host,
    token: instancia.token,
    numero: pedido.whatsapp,
    texto,
    imagem: urlDaArte,
  });

  await registrar(supabase, {
    pedidoId: pedido.id,
    destino: pedido.whatsapp,
    chave: corpo.chave,
    texto,
    temMidia: Boolean(urlDaArte),
    via: "uazapi",
    sucesso: envio.ok,
    resposta: envio.resposta,
    erro: envio.erro,
  });

  if (!envio.ok) {
    // A API falhou, mas o vendedor ainda tem como fechar a venda.
    return responder<Resultado>({
      enviado: false,
      via: "link",
      link: linkManual,
      texto,
      erro: envio.erro,
    });
  }

  return responder<Resultado>({ enviado: true, via: "uazapi", texto });
});

/**
 * Busca a instancia da instalacao e confirma que ela esta conectada.
 *
 * O token nao esta na tabela: vem cifrado do Vault, por uma funcao que so a
 * chave de servico executa. E o unico lugar do sistema que ve o token em claro.
 */
async function instanciaAtiva(
  // deno-lint-ignore no-explicit-any
  supabase: any,
): Promise<{ host: string; token: string } | null> {
  const { data: config } = await supabase
    .from("configuracoes")
    .select("instancia_id")
    .eq("id", true)
    .single();

  const consulta = supabase
    .from("instancias_whatsapp")
    .select("id, host")
    .eq("ativo", true)
    .limit(1);

  const { data } = config?.instancia_id
    ? await consulta.eq("id", config.instancia_id)
    : await consulta;

  const cadastro = data?.[0];
  if (!cadastro) return null;

  const { data: token } = await supabase.rpc("token_da_instancia", {
    p_instancia_id: cadastro.id,
  });

  if (!token) return null;
  const instancia = { host: cadastro.host as string, token: token as string };

  try {
    const resposta = await fetch(`${instancia.host.replace(/\/$/, "")}/instance/status`, {
      headers: { token: instancia.token },
      signal: AbortSignal.timeout(8000),
    });
    if (!resposta.ok) return null;

    const status = await resposta.json();
    const estado = String(
      status?.instance?.status ?? status?.status ?? status?.state ?? "",
    ).toLowerCase();

    // A uazapi responde "connected" quando o aparelho esta pareado.
    return estado.includes("connect") || estado === "open" ? instancia : null;
  } catch {
    return null;
  }
}

async function enviarPelaUazapi({
  host,
  token,
  numero,
  texto,
  imagem,
}: {
  host: string;
  token: string;
  numero: string;
  texto: string;
  imagem: string | null;
}): Promise<{ ok: boolean; resposta?: unknown; erro?: string }> {
  const base = host.replace(/\/$/, "");
  const rota = imagem ? "/send/media" : "/send/text";
  const corpo = imagem
    ? { number: numero, type: "image", file: imagem, text: texto }
    : { number: numero, text: texto, linkPreview: false };

  try {
    const resposta = await fetch(`${base}${rota}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(30000),
    });

    const dados = await resposta.json().catch(() => null);

    if (!resposta.ok) {
      return {
        ok: false,
        resposta: dados,
        erro: `uazapi respondeu ${resposta.status}`,
      };
    }

    return { ok: true, resposta: dados };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "falha de rede" };
  }
}

// deno-lint-ignore no-explicit-any
async function montarTexto(supabase: any, chave: string, pedido: any): Promise<string | null> {
  const { data: modelo } = await supabase
    .from("modelos_mensagem")
    .select("corpo")
    .eq("chave", chave)
    .eq("ativo", true)
    .single();

  if (!modelo) return null;

  const valores: Record<string, string> = {
    nome_negocio: pedido.nome_negocio,
    codigo: pedido.codigo,
    tamanho: pedido.tamanho_codigo,
    cor: pedido.cor === "branco" ? "branco" : "preto",
    tecnologia: pedido.tecnologia === "qr_nfc" ? "QR code e aproximação" : "QR code",
    quantidade: String(pedido.quantidade),
    total: formatarMoeda(pedido.total_centavos),
  };

  return modelo.corpo.replace(
    /\{(\w+)\}/g,
    (original: string, chaveDoCampo: string) => valores[chaveDoCampo] ?? original,
  );
}

function formatarMoeda(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function montarLinkWhatsapp(numero: string, texto: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

async function registrar(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  dados: {
    pedidoId: string;
    destino: string;
    chave?: string;
    texto: string;
    temMidia: boolean;
    via: "uazapi" | "link";
    sucesso: boolean;
    resposta?: unknown;
    erro?: string;
  },
) {
  await supabase.from("mensagens_whatsapp").insert({
    pedido_id: dados.pedidoId,
    destino: dados.destino,
    chave_modelo: dados.chave ?? null,
    corpo: dados.texto,
    tem_midia: dados.temMidia,
    via: dados.via,
    sucesso: dados.sucesso,
    resposta: dados.resposta ?? null,
    erro: dados.erro ?? null,
  });
}

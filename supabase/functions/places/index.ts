// Busca do negocio no Google, para o link de avaliacao nascer certo.
//
// O link que abre a caixa de avaliacao (`g.page/r/.../review`) so aparece no
// painel de quem gerencia o perfil. Colar o encurtado do Maps ou o endereco no
// lugar dele nao da erro nenhum: da um QR que abre a ficha do negocio, onde
// ninguem avalia. E o erro sai impresso em acrilico.
//
// De fora do perfil, o unico caminho ate o link certo e a Places API: ela
// devolve `googleMapsLinks.writeAReviewUri` a partir do id do lugar, e esse
// link abre o formulario direto. Uma busca so ja traz o id, o nome e o link,
// entao nao existe segunda chamada.
//
// A funcao existe porque a chave do Google nao pode aparecer no navegador. Ela
// e um token global de verdade — nao muda por assinante —, entao mora em
// segredo de funcao, que e o caso previsto no README do banco:
//
//   npx supabase secrets set GOOGLE_PLACES_API_KEY=... --project-ref SEUREF

import { createClient } from "jsr:@supabase/supabase-js@2";
import { CABECALHOS_CORS, responder } from "../_shared/cors.ts";

type Corpo = { busca?: string };

export type NegocioEncontrado = {
  placeId: string;
  nome: string;
  endereco: string;
  linkAvaliacao: string;
};

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

// So o que a tela mostra e o que vai gravado. Campo a mais nao muda o preco da
// chamada, mas muda o tamanho da resposta e o que trafega a toa.
const CAMPOS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.googleMapsLinks",
].join(",");

// Oito cabe na tela sem virar rolagem dentro do popup. Quem nao achou nos oito
// primeiros erra menos digitando mais do nome do que descendo a lista.
const LIMITE = 8;

// Menos que isso a busca so devolve ruido, e cada tecla e uma chamada paga.
const MINIMO_DE_BUSCA = 3;

type LugarDoGoogle = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  googleMapsLinks?: { writeAReviewUri?: string };
};

/**
 * Traduz a recusa do Google para o que precisa ser feito no console.
 *
 * As tres primeiras sao erros de configuracao, e o vendedor nao consegue nada
 * repetindo a busca: quem resolve e quem administra o projeto no Google.
 */
function recado(status: number, detalhe: string): string {
  const codigo = (() => {
    try {
      return String((JSON.parse(detalhe) as { error?: { status?: string } }).error?.status ?? "");
    } catch {
      return "";
    }
  })();

  if (codigo === "SERVICE_DISABLED" || detalhe.includes("has not been used in project")) {
    return "A Places API (New) não está habilitada no projeto do Google.";
  }

  if (status === 403) {
    return "O Google recusou a chave. Confira se ela está liberada para a Places API (New).";
  }

  if (status === 429) {
    return "A cota da busca do Google acabou por hoje.";
  }

  return `O Google recusou a busca (${status}${codigo ? ` ${codigo}` : ""}).`;
}

Deno.serve(async (requisicao) => {
  if (requisicao.method === "OPTIONS") {
    return new Response("ok", { headers: CABECALHOS_CORS });
  }

  if (requisicao.method !== "POST") {
    return responder({ erro: "Use POST." }, 405);
  }

  const chave = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!chave) {
    return responder({ erro: "A busca do Google não está configurada." }, 503);
  }

  const jwt = (requisicao.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return responder({ erro: "Sem credencial." }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // A conferencia nao e sobre permissao, e sobre cota: sem ela, qualquer um com
  // o endereco da funcao gasta a franquia mensal do projeto no Google.
  const {
    data: { user },
  } = await supabase.auth.getUser(jwt);
  if (!user) return responder({ erro: "Credencial inválida." }, 401);

  const { data: perfil } = await supabase
    .from("perfis")
    .select("ativo")
    .eq("id", user.id)
    .single();

  if (!perfil?.ativo) return responder({ erro: "Conta sem acesso." }, 403);

  let corpo: Corpo;
  try {
    corpo = await requisicao.json();
  } catch {
    return responder({ erro: "Corpo inválido." }, 400);
  }

  const busca = (corpo.busca ?? "").trim();
  if (busca.length < MINIMO_DE_BUSCA) {
    return responder<{ negocios: NegocioEncontrado[] }>({ negocios: [] });
  }

  let resposta: Response;
  try {
    resposta = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": chave,
        "X-Goog-FieldMask": CAMPOS,
      },
      body: JSON.stringify({
        textQuery: busca,
        languageCode: "pt-BR",
        regionCode: "BR",
        pageSize: LIMITE,
      }),
    });
  } catch {
    return responder({ erro: "Não consegui falar com o Google. Tente de novo." }, 502);
  }

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    console.error("places:", resposta.status, detalhe);

    // O texto cru do Google fica no log, mas o codigo dele sobe ate a tela. Sem
    // isso, chave restrita, API legada habilitada no lugar da nova e cota
    // estourada chegam identicas em quem esta vendendo — e nenhuma das tres se
    // resolve tentando de novo, que e o que "falhou, tente de novo" sugere.
    return responder({ erro: recado(resposta.status, detalhe) }, 502);
  }

  const dados = (await resposta.json()) as { places?: LugarDoGoogle[] };

  const negocios: NegocioEncontrado[] = (dados.places ?? [])
    .filter((lugar): lugar is LugarDoGoogle & { id: string } => Boolean(lugar.id))
    .map((lugar) => ({
      placeId: lugar.id,
      nome: lugar.displayName?.text ?? "",
      endereco: lugar.formattedAddress ?? "",
      // O `writeAReviewUri` e o link canonico, e vem em quase todo lugar
      // publicado. Quando falta, o formato por placeid abre a mesma caixa —
      // e melhor que devolver o negocio sem link, que o vendedor completaria
      // colando qualquer coisa.
      linkAvaliacao: lugar.googleMapsLinks?.writeAReviewUri ??
        `https://search.google.com/local/writereview?placeid=${lugar.id}`,
    }))
    .filter((negocio) => negocio.nome.length > 0);

  return responder<{ negocios: NegocioEncontrado[] }>({ negocios });
});

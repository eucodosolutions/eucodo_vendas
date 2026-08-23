"use client";

import { Check, ExternalLink, Loader2, MapPin, Search, Store, X } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { ALTURA_CONTROLE, BORDA_ERRO, BORDA_NORMAL, juntar, MOLDURA_CONTROLE } from "./controle";
import { validarLinkAvaliacao } from "@/lib/formato";
import { buscarNegocio, type NegocioEncontrado } from "@/lib/places/buscar";

/** O que a tela precisa saber depois que o negocio foi resolvido. */
export type NegocioEscolhido = {
  /** So existe quando veio da lista: os outros dois caminhos ainda vao cadastrar. */
  id?: string;
  nome: string;
  linkAvaliacao: string;
  /** So existe quando veio da busca; o link colado a mao nao tem id. */
  placeId?: string;
  endereco?: string;
};

/** Uma linha da agenda de negocios, do jeito que a lista chega do servidor. */
export type NegocioCadastrado = {
  id: string;
  nome: string;
  link_avaliacao: string;
  google_place_id: string | null;
  endereco: string | null;
};

const MINIMO_DE_BUSCA = 3;
const CABEM_NA_LISTA = 6;

type Modo = "cadastrados" | "busca" | "link";

/**
 * Como o link de avaliacao entra no sistema.
 *
 * Sao tres jeitos de responder a mesma pergunta — que negocio e este? — e por
 * isso sao abas, e nao links soltos: um deles esta sempre valendo.
 *
 *   1. A agenda. O negocio ja foi cadastrado, na rota de ontem ou numa venda
 *      anterior, e escolhe-lo nao custa busca nenhuma nem chance de errar o
 *      link. So aparece para quem recebeu a lista.
 *   2. A busca no Google. O caminho de quem chega num negocio novo: o link que
 *      abre a caixa de avaliacao so existe dentro do painel de quem gerencia o
 *      perfil, e de fora quem sabe monta-lo e a Places API.
 *   3. O link colado. Quem gerencia o proprio perfil ja tem o link certo.
 *
 * Colar o encurtado do Maps parece dar certo e nao da: vira um QR que abre a
 * ficha do negocio, onde ninguem avalia.
 *
 * A busca no Google so acontece no clique, e nunca enquanto se digita. Cada
 * chamada e paga, e busca por tecla cobra o caminho inteiro do nome — "B",
 * "Ba", "Bar" — para entregar so a ultima. O nome tambem costuma vir errado da
 * memoria de quem vende, entao o "Abrir no Google" esta ali para o nome exato
 * ser copiado de la e colado aqui: uma chamada, com o termo certo.
 */
export function BuscaDeNegocio({
  escolhido,
  aoEscolher,
  cadastrados,
}: {
  escolhido: NegocioEscolhido | null;
  aoEscolher: (negocio: NegocioEscolhido | null) => void;
  /**
   * A agenda de quem esta vendendo. Ausente no proprio cadastro de negocio, que
   * existe justamente para criar o que ainda nao esta nela.
   */
  cadastrados?: NegocioCadastrado[];
}) {
  const temAgenda = Boolean(cadastrados && cadastrados.length > 0);

  const [modo, setModo] = useState<Modo>(temAgenda ? "cadastrados" : "busca");
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<NegocioEncontrado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [jaBuscou, setJaBuscou] = useState(false);

  const rotuloId = useId();
  const curto = termo.trim().length < MINIMO_DE_BUSCA;

  async function pesquisar() {
    const procurado = termo.trim();
    if (procurado.length < MINIMO_DE_BUSCA || buscando) return;

    setBuscando(true);
    setErro(null);

    const resposta = await buscarNegocio(procurado);

    setResultados(resposta.negocios);
    setErro(resposta.erro ?? null);
    setJaBuscou(true);
    setBuscando(false);
  }

  // Mudou o termo, a lista de antes nao vale mais: resultado velho embaixo de
  // texto novo e o convite para escolher o negocio errado.
  function digitar(valor: string) {
    setTermo(valor);
    setResultados([]);
    setErro(null);
    setJaBuscou(false);
  }

  function limpar() {
    aoEscolher(null);
    setTermo("");
    setResultados([]);
    setErro(null);
    setJaBuscou(false);
    setModo(temAgenda ? "cadastrados" : "busca");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span id={rotuloId} className="text-rotulo font-medium text-tinta">
          Negócio no Google
        </span>

        {/* Discreto de proposito: e apoio para achar o nome certo, e nao o
            caminho. Some com o negocio ja resolvido e fora da busca paga. */}
        {!escolhido && modo === "busca" ? (
          <a
            href={
              curto
                ? "https://www.google.com/maps"
                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(termo.trim())}`
            }
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-1 text-xs text-tinta-suave transition-colors hover:text-marca"
          >
            <ExternalLink size={12} aria-hidden />
            Abrir no Google
          </a>
        ) : null}
      </div>

      {escolhido ? (
        <div className="flex items-start gap-3 rounded-lg border border-marca bg-marca-suave px-3 py-2.5">
          <Check size={16} aria-hidden className="mt-0.5 shrink-0 text-marca" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-marca">
              {escolhido.nome || "Link do próprio perfil"}
            </p>
            <p className="truncate text-xs text-tinta-suave">
              {escolhido.endereco ?? escolhido.linkAvaliacao}
            </p>
          </div>
          <button
            type="button"
            onClick={limpar}
            aria-label="Trocar de negócio"
            className="shrink-0 rounded p-1 text-tinta-suave transition-colors hover:text-tinta"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-4 border-b border-borda">
            {temAgenda ? (
              <Aba ativa={modo === "cadastrados"} aoTocar={() => setModo("cadastrados")}>
                Meus negócios
              </Aba>
            ) : null}
            <Aba ativa={modo === "busca"} aoTocar={() => setModo("busca")}>
              {/* Com tres abas os rotulos longos nao cabem num celular. */}
              {temAgenda ? "Pesquisar" : "Pesquisar no Google"}
            </Aba>
            <Aba ativa={modo === "link"} aoTocar={() => setModo("link")}>
              {temAgenda ? "Tenho o link" : "Já tenho o link"}
            </Aba>
          </div>

          {modo === "cadastrados" ? (
            <Agenda negocios={cadastrados ?? []} aoEscolher={aoEscolher} />
          ) : null}

          {modo === "busca" ? (
            <>
              <div className="flex gap-2">
                <input
                  type="text"
                  aria-labelledby={rotuloId}
                  autoComplete="off"
                  placeholder="Cole aqui o nome exato do negócio"
                  value={termo}
                  onChange={(evento) => digitar(evento.target.value)}
                  // Enter dentro de um popup que tem botao de salvar submeteria
                  // o popup inteiro. Aqui ele pesquisa, que e o que se espera de
                  // um campo de busca.
                  onKeyDown={(evento) => {
                    if (evento.key !== "Enter") return;
                    evento.preventDefault();
                    void pesquisar();
                  }}
                  className={juntar(
                    ALTURA_CONTROLE,
                    MOLDURA_CONTROLE,
                    BORDA_NORMAL,
                    "flex-1 px-3 placeholder:text-tinta-suave/70",
                  )}
                />

                <button
                  type="button"
                  onClick={() => void pesquisar()}
                  disabled={curto || buscando}
                  aria-label="Pesquisar no Google"
                  className={juntar(
                    ALTURA_CONTROLE,
                    "flex w-10 shrink-0 items-center justify-center rounded-lg border border-borda-forte bg-superficie text-tinta transition-colors",
                    "hover:border-tinta-suave disabled:opacity-50 disabled:hover:border-borda-forte",
                  )}
                >
                  {buscando ? (
                    <Loader2 size={16} aria-hidden className="animate-spin" />
                  ) : (
                    <Search size={16} aria-hidden />
                  )}
                </button>
              </div>

              {resultados.length > 0 ? (
                <ul className="divide-y divide-borda overflow-hidden rounded-lg border border-borda">
                  {resultados.map((negocio) => (
                    <li key={negocio.placeId}>
                      <button
                        type="button"
                        onClick={() =>
                          aoEscolher({
                            nome: negocio.nome,
                            linkAvaliacao: negocio.linkAvaliacao,
                            placeId: negocio.placeId,
                            endereco: negocio.endereco,
                          })
                        }
                        className="flex w-full items-start gap-3 bg-superficie px-3 py-2.5 text-left transition-colors hover:bg-papel"
                      >
                        <MapPin
                          size={15}
                          aria-hidden
                          className="mt-0.5 shrink-0 text-tinta-suave"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-tinta">{negocio.nome}</p>
                          <p className="truncate text-xs text-tinta-suave">{negocio.endereco}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {erro ? <p className="text-xs font-medium text-erro">{erro}</p> : null}

              {!erro && jaBuscou && resultados.length === 0 ? (
                <p className="text-xs text-tinta-suave">
                  Nada com esse nome. Abra o Google e copie o nome como está escrito lá.
                </p>
              ) : null}
            </>
          ) : null}

          {modo === "link" ? (
            <ColarLink aoColar={(link) => aoEscolher({ nome: "", linkAvaliacao: link })} />
          ) : null}
        </>
      )}
    </div>
  );
}

/**
 * Um negocio e um destino de avaliacao, e nao uma linha da tabela.
 *
 * A mesma porta entra na agenda mais de uma vez sem nenhum bug no caminho: a
 * unicidade do banco e por autor, entao o assinante — que enxerga a conta
 * inteira — ve o negocio que ele cadastrou e o que o vendedor dele cadastrou
 * como duas linhas. Para quem esta escolhendo onde a placa vai, sao a mesma
 * coisa, e duas linhas iguais na tela sao so a chance de tocar na errada.
 *
 * A chave e o place id quando existe, porque o mesmo negocio tem mais de um
 * formato de link valido — `g.page/r/.../review` e `search.google.com/local/
 * writereview?placeid=...` levam ao mesmo formulario e sao strings diferentes.
 * Sem place id sobra o proprio link, que e o mais longe que da para ir sem
 * inventar: dois negocios podem se chamar igual, e juntar por nome esconderia
 * um deles.
 */
function identidade(negocio: NegocioCadastrado): string {
  return negocio.google_place_id || negocio.link_avaliacao;
}

/**
 * A agenda: os negocios que ja estao cadastrados.
 *
 * Nada aparece antes da busca, como no cliente. A lista abria com os seis
 * primeiros, na ideia de que os seis mais recentes seriam a rota de ontem —
 * mas o que chega na tela e uma parede de nomes parecidos por cima do resto do
 * popup, e o vendedor precisa rolar por ela para chegar na cor e na quantidade.
 * Digitar tres letras acha mais rapido do que ler seis linhas.
 */
function Agenda({
  negocios,
  aoEscolher,
}: {
  negocios: NegocioCadastrado[];
  aoEscolher: (negocio: NegocioEscolhido) => void;
}) {
  const [termo, setTermo] = useState("");

  // O mais recente ganha: a lista chega do servidor por `criado_em desc`, e o
  // nome que a pessoa escreveu na ultima vez e o que ela espera reconhecer.
  const agenda = useMemo(() => {
    const porDestino = new Map<string, NegocioCadastrado>();
    for (const negocio of negocios) {
      const chave = identidade(negocio);
      if (!porDestino.has(chave)) porDestino.set(chave, negocio);
    }
    return [...porDestino.values()];
  }, [negocios]);

  const procurado = termo.trim();

  const encontrados = useMemo(() => {
    if (!procurado) return [];

    const alvo = procurado.toLowerCase();
    return agenda
      .filter(
        (negocio) =>
          negocio.nome.toLowerCase().includes(alvo) ||
          (negocio.endereco ?? "").toLowerCase().includes(alvo),
      )
      .slice(0, CABEM_NA_LISTA);
  }, [procurado, agenda]);

  return (
    <>
      <input
        type="search"
        aria-label="Buscar nos meus negócios"
        autoComplete="off"
        placeholder="Buscar por nome ou endereço"
        value={termo}
        // Enter aqui nao faz nada: o filtro ja rodou a cada tecla, e sem isto
        // ele submeteria o popup que envolve o campo.
        onKeyDown={(evento) => {
          if (evento.key === "Enter") evento.preventDefault();
        }}
        onChange={(evento) => setTermo(evento.target.value)}
        className={juntar(
          ALTURA_CONTROLE,
          MOLDURA_CONTROLE,
          BORDA_NORMAL,
          "px-3 placeholder:text-tinta-suave/70",
        )}
      />

      {!procurado ? (
        <p className="text-xs text-tinta-suave">
          Digite o nome ou o endereço para achar entre os seus {agenda.length}{" "}
          {agenda.length === 1 ? "negócio" : "negócios"}.
        </p>
      ) : encontrados.length === 0 ? (
        <p className="text-xs text-tinta-suave">
          Nenhum negócio com esse nome. Pesquise no Google para cadastrar um novo.
        </p>
      ) : (
        <ul className="divide-y divide-borda overflow-hidden rounded-lg border border-borda">
          {encontrados.map((negocio) => (
            <li key={negocio.id}>
              <button
                type="button"
                onClick={() =>
                  aoEscolher({
                    id: negocio.id,
                    nome: negocio.nome,
                    linkAvaliacao: negocio.link_avaliacao,
                    placeId: negocio.google_place_id ?? undefined,
                    endereco: negocio.endereco ?? undefined,
                  })
                }
                className="flex w-full items-start gap-3 bg-superficie px-3 py-2.5 text-left transition-colors hover:bg-papel"
              >
                <Store size={15} aria-hidden className="mt-0.5 shrink-0 text-tinta-suave" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-tinta">{negocio.nome}</p>
                  {negocio.endereco ? (
                    <p className="truncate text-xs text-tinta-suave">{negocio.endereco}</p>
                  ) : null}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Aba({
  ativa,
  aoTocar,
  children,
}: {
  ativa: boolean;
  aoTocar: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={aoTocar}
      aria-pressed={ativa}
      className={juntar(
        "-mb-px border-b-2 pb-2 text-sm font-medium transition-colors",
        ativa
          ? "border-marca text-marca"
          : "border-transparent text-tinta-suave hover:text-tinta",
      )}
    >
      {children}
    </button>
  );
}

/**
 * O escape: quem gerencia o perfil ja tem o link certo e nao precisa procurar.
 *
 * O que ele confere e o formato, e nao o dominio. Aceitar maps.app.goo.gl era o
 * problema antigo: o link e do Google, abre normalmente, e leva para a ficha do
 * negocio em vez do formulario de avaliacao.
 */
function ColarLink({ aoColar }: { aoColar: (link: string) => void }) {
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  function confirmar() {
    const link = validarLinkAvaliacao(texto);
    if (!link) {
      setErro("Este link não abre a caixa de avaliação. Use o do painel do Google.");
      return;
    }

    setErro(null);
    aoColar(link);
  }

  return (
    <>
      <input
        type="url"
        inputMode="url"
        autoComplete="off"
        placeholder="https://g.page/r/.../review"
        value={texto}
        onChange={(evento) => {
          setTexto(evento.target.value);
          setErro(null);
        }}
        onBlur={() => {
          if (texto.trim()) confirmar();
        }}
        onKeyDown={(evento) => {
          if (evento.key !== "Enter") return;
          evento.preventDefault();
          confirmar();
        }}
        aria-invalid={erro ? true : undefined}
        className={juntar(
          ALTURA_CONTROLE,
          MOLDURA_CONTROLE,
          erro ? BORDA_ERRO : BORDA_NORMAL,
          "px-3 placeholder:text-tinta-suave/70",
        )}
      />

      {erro ? (
        <p className="text-xs font-medium text-erro">{erro}</p>
      ) : (
        <p className="text-xs text-tinta-suave">
          É o link de <strong>Peça avaliações</strong>, no painel do Perfil da Empresa. O encurtado
          do Maps não serve: ele abre a ficha, não a avaliação.
        </p>
      )}
    </>
  );
}

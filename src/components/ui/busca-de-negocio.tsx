"use client";

import { Check, ExternalLink, Link2, MapPin, Search, X } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { Botao } from "./botao";
import { ALTURA_CONTROLE, BORDA_ERRO, BORDA_NORMAL, juntar, MOLDURA_CONTROLE } from "./controle";
import { validarLinkAvaliacao } from "@/lib/formato";
import { buscarNegocio, type NegocioEncontrado } from "@/lib/places/buscar";

/** O que a tela precisa saber depois que o negocio foi resolvido. */
export type NegocioEscolhido = {
  nome: string;
  linkAvaliacao: string;
  /** So existe quando veio da busca; o link colado a mao nao tem id. */
  placeId?: string;
};

const MINIMO_DE_BUSCA = 3;

/**
 * Como o link de avaliacao entra no sistema.
 *
 * O caminho normal e buscar o negocio no Google, porque o link que abre a caixa
 * de avaliacao so existe dentro do painel de quem gerencia o perfil — de fora,
 * quem sabe monta-lo e a Places API. Colar o encurtado do Maps parece dar certo
 * e nao da: vira um QR que abre a ficha do negocio, onde ninguem avalia.
 *
 * A busca so acontece no clique, e nunca enquanto se digita. Cada chamada e
 * paga, e busca por tecla cobra o caminho inteiro do nome — "B", "Ba", "Bar" —
 * para entregar so a ultima. O nome tambem costuma vir errado da memoria de
 * quem vende, entao o botao de abrir o Google esta ali para o nome exato ser
 * copiado de la e colado aqui: uma chamada, com o termo certo.
 *
 * O campo de colar continua existindo, atras de um clique, para quem chega com
 * o g.page do proprio perfil na mao.
 */
export function BuscaDeNegocio({
  escolhido,
  aoEscolher,
}: {
  escolhido: NegocioEscolhido | null;
  aoEscolher: (negocio: NegocioEscolhido | null) => void;
}) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<NegocioEncontrado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [jaBuscou, setJaBuscou] = useState(false);
  const [manual, setManual] = useState(false);

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
  }

  if (escolhido) {
    return (
      <Moldura rotuloId={rotuloId}>
        <div className="flex items-start gap-3 rounded-lg border border-marca bg-marca-suave px-3 py-2.5">
          <Check size={16} aria-hidden className="mt-0.5 shrink-0 text-marca" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-marca">
              {escolhido.nome || "Link do próprio perfil"}
            </p>
            <p className="truncate text-xs text-tinta-suave">{escolhido.linkAvaliacao}</p>
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
      </Moldura>
    );
  }

  if (manual) {
    return (
      <Moldura rotuloId={rotuloId}>
        <ColarLink
          aoColar={(link) => aoEscolher({ nome: "", linkAvaliacao: link })}
          aoDesistir={() => setManual(false)}
        />
      </Moldura>
    );
  }

  return (
    <Moldura rotuloId={rotuloId}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-tinta-suave"
          />
          <input
            type="text"
            aria-labelledby={rotuloId}
            autoComplete="off"
            placeholder="Cole aqui o nome exato do negócio"
            value={termo}
            onChange={(evento) => digitar(evento.target.value)}
            // Enter dentro de um popup que tem botao de salvar submeteria o
            // popup inteiro. Aqui ele pesquisa, que e o que se espera de um
            // campo de busca.
            onKeyDown={(evento) => {
              if (evento.key !== "Enter") return;
              evento.preventDefault();
              void pesquisar();
            }}
            className={juntar(
              ALTURA_CONTROLE,
              MOLDURA_CONTROLE,
              BORDA_NORMAL,
              "pr-3 pl-9 placeholder:text-tinta-suave/70",
            )}
          />
        </div>

        <Botao
          type="button"
          variante="secundario"
          onClick={() => void pesquisar()}
          disabled={curto || buscando}
          carregandoTexto="Buscando..."
        >
          {buscando ? "Buscando..." : "Pesquisar"}
        </Botao>
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
                  })
                }
                className="flex w-full items-start gap-3 bg-superficie px-3 py-2.5 text-left transition-colors hover:bg-papel"
              >
                <MapPin size={15} aria-hidden className="mt-0.5 shrink-0 text-tinta-suave" />
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

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <a
          href={
            curto
              ? "https://www.google.com/maps"
              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(termo.trim())}`
          }
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center gap-1.5 text-xs font-medium text-marca transition-colors hover:text-marca-escura"
        >
          <ExternalLink size={13} aria-hidden />
          Abrir o Google para achar o nome
        </a>

        <button
          type="button"
          onClick={() => setManual(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-marca transition-colors hover:text-marca-escura"
        >
          <Link2 size={13} aria-hidden />
          Já tenho o link do perfil
        </button>
      </div>
    </Moldura>
  );
}

function Moldura({ rotuloId, children }: { rotuloId: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span id={rotuloId} className="text-rotulo font-medium text-tinta">
        Negócio no Google
      </span>
      {children}
    </div>
  );
}

/**
 * O escape: quem gerencia o perfil ja tem o link certo e nao precisa procurar.
 *
 * O que ele confere e o formato, e nao o dominio. Aceitar maps.app.goo.gl era o
 * problema antigo: o link e do Google, abre normalmente, e leva para a ficha do
 * negocio em vez do formulario de avaliacao.
 */
function ColarLink({
  aoColar,
  aoDesistir,
}: {
  aoColar: (link: string) => void;
  aoDesistir: () => void;
}) {
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
        autoFocus
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

      <button
        type="button"
        onClick={aoDesistir}
        className="flex items-center gap-1.5 self-start text-xs font-medium text-marca transition-colors hover:text-marca-escura"
      >
        <Search size={13} aria-hidden />
        Procurar o negócio no Google
      </button>
    </>
  );
}

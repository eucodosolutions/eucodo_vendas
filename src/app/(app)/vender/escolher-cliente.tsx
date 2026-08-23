"use client";

import { Check, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";

import { ModalCliente, type ClienteGravado } from "../clientes/modal-cliente";
import { Botao } from "@/components/ui/botao";
import { CampoDeBusca } from "@/components/ui/campo-de-busca";
import { whatsappLegivel } from "@/lib/formato";

export type ClienteDaLista = { id: string; nome: string; whatsapp: string };

/** Termo que so tem numero e pontuacao de telefone: quem digita assim quer um numero. */
function pareceNumero(termo: string): boolean {
  return /^[\d\s()+.-]+$/.test(termo) && termo.replace(/\D/g, "").length >= 3;
}

/**
 * O passo do fecho: para quem e este pedido.
 *
 * Sai sem moldura porque hoje ele mora dentro do popup de fechamento, que ja
 * tem a sua. Era uma secao de pagina inteira quando o fecho acontecia solto
 * no meio da tela de venda.
 *
 * A lista inteira da conta vem do servidor e o filtro roda aqui, sem ida e
 * volta: com o cliente na frente, esperar a rede para achar um nome que ja
 * esta na tela seria tempo jogado fora.
 *
 * Nada aparece antes da busca. A lista abria com os seis primeiros nomes da
 * conta, que numa conta com trezentos clientes eram seis nomes por acaso — o
 * vendedor lia uma lista que nao respondia nada e ainda arriscava tocar no
 * cliente errado, com o proximo homonimo logo abaixo.
 *
 * O cadastro e a ultima linha do resultado, e nao um botao a parte: quem nao
 * achou o cliente ja esta olhando para ali, com o nome digitado na mao. O que
 * foi digitado entra no popup pronto, no campo que ele parece ser.
 */
export function EscolherCliente({
  clientes,
  escolhido,
  aoEscolher,
}: {
  clientes: ClienteDaLista[];
  escolhido: ClienteDaLista | null;
  aoEscolher: (cliente: ClienteDaLista | null) => void;
}) {
  const [busca, setBusca] = useState("");
  const [cadastrando, setCadastrando] = useState(false);
  const [rodada, setRodada] = useState(0);

  // O cadastro acontece sem recarregar a pagina, entao a lista que veio do
  // servidor nao sabe do cliente novo ate a proxima visita.
  const [novos, setNovos] = useState<ClienteDaLista[]>([]);
  const lista = useMemo(() => [...novos, ...clientes], [novos, clientes]);

  const termo = busca.trim();
  const ehNumero = pareceNumero(termo);

  const encontrados = useMemo(() => {
    if (!termo) return [];

    const alvo = termo.toLowerCase();
    const digitos = termo.replace(/\D/g, "");

    return lista
      .filter(
        (cliente) =>
          cliente.nome.toLowerCase().includes(alvo) ||
          (digitos.length >= 3 && cliente.whatsapp.includes(digitos)),
      )
      .slice(0, 6);
  }, [termo, lista]);

  function fecharCadastro() {
    setCadastrando(false);
    setRodada((valor) => valor + 1);
  }

  function aoCadastrar(gravado: ClienteGravado) {
    setNovos((atuais) => [gravado, ...atuais]);

    // Fecha aqui, e nao no `aoFechar` do popup: escolher o cliente troca esta
    // tela pelo resumo, o popup desmonta junto e o efeito que fecharia sozinho
    // nunca chega a rodar. Sem isto, `cadastrando` fica de pe e o popup vazio
    // pula na tela no proximo "Trocar cliente".
    fecharCadastro();
    aoEscolher(gravado);
  }

  if (escolhido) {
    return (
      <div className="rounded-lg border border-borda bg-papel p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-medium text-tinta">{escolhido.nome}</p>
            <p className="text-sm text-tinta-suave tabular-nums">
              {whatsappLegivel(escolhido.whatsapp)}
            </p>
          </div>
          <Botao type="button" variante="secundario" onClick={() => aoEscolher(null)}>
            Trocar cliente
          </Botao>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <CampoDeBusca
          rotulo="Buscar cliente"
          placeholder="Buscar cliente por nome ou WhatsApp"
          value={busca}
          aoMudar={(evento) => setBusca(evento.target.value)}
        />

        {termo && encontrados.length === 0 ? (
          <p className="text-sm text-tinta-suave">Nenhum cliente com esse nome ou número.</p>
        ) : null}

        {!termo ? (
          <p className="text-sm text-tinta-suave">
            Digite o nome ou o WhatsApp para achar o cliente.
          </p>
        ) : null}

        <ul className="flex flex-col gap-1.5">
          {encontrados.map((cliente) => (
            <li key={cliente.id}>
              <button
                type="button"
                onClick={() => aoEscolher(cliente)}
                className="flex w-full items-center gap-3 rounded-lg border border-borda px-3 py-2.5 text-left transition-colors hover:border-marca hover:bg-marca-suave"
              >
                <Check size={16} aria-hidden className="shrink-0 text-tinta-suave" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-tinta">
                  {cliente.nome}
                </span>
                <span className="shrink-0 text-sm text-tinta-suave tabular-nums">
                  {whatsappLegivel(cliente.whatsapp)}
                </span>
              </button>
            </li>
          ))}

          {/* Fica no fim mesmo quando a busca achou gente: dois clientes podem
              ter o mesmo nome, e o terceiro homonimo ainda precisa nascer. */}
          <li>
            <button
              type="button"
              onClick={() => setCadastrando(true)}
              className="flex w-full items-center gap-3 rounded-lg border border-dashed border-borda px-3 py-2.5 text-left transition-colors hover:border-marca hover:bg-marca-suave"
            >
              <UserPlus size={16} aria-hidden className="shrink-0 text-tinta-suave" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-tinta">
                {termo ? (
                  <>
                    Cadastrar <span className="font-semibold text-marca">{termo}</span> como cliente
                    novo
                  </>
                ) : (
                  "Cadastrar cliente novo"
                )}
              </span>
            </button>
          </li>
        </ul>
      </div>

      <ModalCliente
        key={rodada}
        aberto={cadastrando}
        aoFechar={fecharCadastro}
        nomeSugerido={ehNumero ? undefined : termo}
        whatsappSugerido={ehNumero ? termo : undefined}
        aoSalvar={aoCadastrar}
      />
    </>
  );
}

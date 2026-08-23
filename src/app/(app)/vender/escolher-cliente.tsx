"use client";

import { Check, Search, UserPlus } from "lucide-react";
import { useMemo, useState, useTransition, type FormEvent } from "react";

import { cadastrarClienteRapido } from "../clientes/actions";
import { avisar } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { CampoWhatsapp } from "@/components/ui/campo-whatsapp";
import { Secao } from "@/components/ui/secao";
import { whatsappLegivel } from "@/lib/formato";

export type ClienteDaLista = { id: string; nome: string; whatsapp: string };

/**
 * O passo do fecho: para quem e este pedido.
 *
 * A lista inteira da conta vem do servidor e o filtro roda aqui, sem ida e
 * volta: com o cliente na frente, esperar a rede para achar um nome que ja
 * esta na tela seria tempo jogado fora. Quem nao esta na lista e cadastrado na
 * hora, com o minimo que o sistema exige, nome e WhatsApp.
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
  const [salvando, iniciarCadastro] = useTransition();

  const [novos, setNovos] = useState<ClienteDaLista[]>([]);
  const lista = useMemo(() => [...novos, ...clientes], [novos, clientes]);

  const encontrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const digitos = termo.replace(/\D/g, "");

    if (!termo) return lista.slice(0, 6);

    return lista
      .filter(
        (cliente) =>
          cliente.nome.toLowerCase().includes(termo) ||
          (digitos.length >= 3 && cliente.whatsapp.includes(digitos)),
      )
      .slice(0, 6);
  }, [busca, lista]);

  function cadastrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    const campos = new FormData(evento.currentTarget);
    const nome = String(campos.get("nome") ?? "").trim();
    const whatsapp = String(campos.get("whatsapp") ?? "");

    iniciarCadastro(async () => {
      const resposta = await cadastrarClienteRapido({ nome, whatsapp });

      if (resposta.erro || !resposta.clienteId) {
        avisar.erro(resposta.erro ?? "Não consegui cadastrar o cliente.");
        return;
      }

      const cliente = { id: resposta.clienteId, nome, whatsapp: normalizar(whatsapp) };

      setNovos((atuais) => [cliente, ...atuais]);
      aoEscolher(cliente);
      setCadastrando(false);
      avisar.sucesso(`${cliente.nome} cadastrado e escolhido para este pedido.`);
    });
  }

  if (escolhido) {
    return (
      <Secao titulo="Cliente do pedido">
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
      </Secao>
    );
  }

  return (
    <Secao titulo="Cliente do pedido">
      {cadastrando ? (
        <form onSubmit={cadastrar} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              rotulo="Nome"
              name="nome"
              placeholder="Barbearia Vintage"
              autoComplete="off"
              required
              autoFocus
            />
            <CampoWhatsapp autoComplete="off" required />
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Botao type="button" variante="secundario" onClick={() => setCadastrando(false)}>
              Voltar para a busca
            </Botao>
            <Botao type="submit" disabled={salvando}>
              {salvando ? "Cadastrando..." : "Cadastrar e usar"}
            </Botao>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search
              size={16}
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-tinta-suave"
            />
            <input
              type="search"
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Buscar cliente por nome ou WhatsApp"
              aria-label="Buscar cliente"
              className="h-10 w-full rounded-lg border border-borda bg-superficie pr-3 pl-9 text-sm text-tinta transition-colors hover:border-borda-forte placeholder:text-tinta-suave/70"
            />
          </div>

          {encontrados.length > 0 ? (
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
            </ul>
          ) : (
            <p className="text-sm text-tinta-suave">
              Nenhum cliente com esse nome ou número. Cadastre agora.
            </p>
          )}

          <div>
            <Botao type="button" variante="secundario" onClick={() => setCadastrando(true)}>
              <UserPlus size={16} aria-hidden />
              Cadastrar cliente novo
            </Botao>
          </div>
        </div>
      )}
    </Secao>
  );
}

/** Mesma normalizacao do servidor, so para a lista local mostrar o numero certo. */
function normalizar(bruto: string): string {
  let digitos = bruto.replace(/\D/g, "");
  if (digitos.startsWith("0")) digitos = digitos.slice(1);
  if (!digitos.startsWith("55")) digitos = `55${digitos}`;
  return digitos;
}

"use client";

import { useActionState, useMemo, useState } from "react";

import { criarPedido, type EstadoVenda } from "./actions";
import { useAviso } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { Secao } from "@/components/ui/secao";
import { moeda, ROTULO_COR, ROTULO_TECNOLOGIA } from "@/lib/formato";
import type { CorArte, TecnologiaArte } from "@/types/database";

export type TamanhoComVariantes = {
  codigo: string;
  rotulo: string;
  largura_mm: number;
  altura_mm: number;
  ordem: number;
  variantes: Array<{
    id: string;
    cor: CorArte;
    tecnologia: TecnologiaArte;
    preco_centavos: number;
    ativo: boolean;
  }>;
};

const TECNOLOGIAS: TecnologiaArte[] = ["qr_nfc", "qr"];
const CORES: CorArte[] = ["branco", "preto"];

export function VendaRapida({ tamanhos }: { tamanhos: TamanhoComVariantes[] }) {
  const [estado, acao] = useActionState<EstadoVenda, FormData>(criarPedido, {});
  useAviso(estado);

  const [codigoTamanho, setCodigoTamanho] = useState(tamanhos[0].codigo);
  const [tecnologia, setTecnologia] = useState<TecnologiaArte>("qr_nfc");
  const [cor, setCor] = useState<CorArte>("branco");
  const [quantidade, setQuantidade] = useState(1);

  const tamanho = tamanhos.find((item) => item.codigo === codigoTamanho) ?? tamanhos[0];

  const variante = useMemo(
    () => tamanho.variantes.find((item) => item.tecnologia === tecnologia && item.cor === cor),
    [tamanho, tecnologia, cor],
  );

  const total = variante ? variante.preco_centavos * quantidade : 0;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-tinta">Venda rapida</h1>
        <p className="mt-1 text-sm text-tinta-suave">
          Mostre os precos na tela, escolha o modelo e feche o pedido.
        </p>
      </header>

      {/* Este bloco e feito para ser virado para o cliente ver. */}
      <Secao>
        <div className="flex flex-col gap-5">
          <Escolha
            titulo="Tamanho"
            opcoes={tamanhos.map((item) => ({
              valor: item.codigo,
              rotulo: item.rotulo,
              detalhe: `${formatarMm(item.largura_mm)} x ${formatarMm(item.altura_mm)} mm`,
            }))}
            selecionado={codigoTamanho}
            aoSelecionar={setCodigoTamanho}
          />

          <Escolha
            titulo="Tecnologia"
            opcoes={TECNOLOGIAS.map((valor) => ({
              valor,
              rotulo: valor === "qr_nfc" ? "QR + aproximacao" : "So QR code",
              detalhe: precoDe(tamanho, valor, cor),
            }))}
            selecionado={tecnologia}
            aoSelecionar={setTecnologia}
          />

          <Escolha
            titulo="Arte"
            opcoes={CORES.map((valor) => ({
              valor,
              rotulo: ROTULO_COR[valor],
              detalhe: valor === "branco" ? "Fundo claro" : "Fundo escuro",
            }))}
            selecionado={cor}
            aoSelecionar={setCor}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-borda pt-5">
          <div>
            <span className="text-xs font-medium tracking-wide text-tinta-suave uppercase">
              {tamanho.rotulo}, {ROTULO_COR[cor].toLowerCase()},{" "}
              {ROTULO_TECNOLOGIA[tecnologia].toLowerCase()}
            </span>
            <p className="mt-1 text-4xl font-semibold tracking-tight text-tinta tabular-nums">
              {variante ? moeda(variante.preco_centavos) : "Indisponivel"}
            </p>
          </div>
          <div className="w-24">
            <Campo
              rotulo="Quantidade"
              name="quantidade"
              form="formulario-pedido"
              type="number"
              min={1}
              max={999}
              value={quantidade}
              onChange={(evento) => setQuantidade(Math.max(1, Number(evento.target.value) || 1))}
            />
          </div>
        </div>
      </Secao>

      <form id="formulario-pedido" action={acao} className="flex flex-col gap-5">
        <input type="hidden" name="varianteId" value={variante?.id ?? ""} />

        <Secao titulo="Dados do cliente">
          <div className="flex flex-col gap-4">
            {!variante ? (
              <p className="rounded-lg bg-atencao-suave px-3.5 py-3 text-sm font-medium text-atencao">
                Essa combinacao ainda nao tem preco cadastrado. Escolha outra ou cadastre em
                Ajustes.
              </p>
            ) : null}

            <Campo
              rotulo="Nome do negocio"
              name="nomeNegocio"
              required
              autoComplete="organization"
              placeholder="Barbearia Vintage"
              ajuda="E este nome que vai impresso no display, no lugar do logo do Google."
            />

            <Campo
              rotulo="WhatsApp do cliente"
              name="whatsapp"
              required
              inputMode="tel"
              placeholder="(85) 9 8707-3847"
            />

            <Campo
              rotulo="Link de avaliacao do Google"
              name="linkAvaliacao"
              required
              inputMode="url"
              placeholder="https://g.page/r/.../review"
              ajuda="Aceita o link do g.page, o encurtado do Maps ou o endereco completo."
            />

            <Campo rotulo="Observacoes" name="observacoes" placeholder="Opcional, so para voce" />
          </div>
        </Secao>

        <Secao>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs font-medium tracking-wide text-tinta-suave uppercase">
                Total do pedido
              </span>
              <p className="text-2xl font-semibold tracking-tight text-tinta tabular-nums">
                {moeda(total)}
              </p>
            </div>
            <Botao type="submit" disabled={!variante} carregandoTexto="Gerando a arte...">
              Fechar pedido
            </Botao>
          </div>
        </Secao>
      </form>
    </div>
  );
}

function precoDe(tamanho: TamanhoComVariantes, tecnologia: TecnologiaArte, cor: CorArte): string {
  const variante = tamanho.variantes.find(
    (item) => item.tecnologia === tecnologia && item.cor === cor,
  );
  return variante ? moeda(variante.preco_centavos) : "Sem preco";
}

function formatarMm(valor: number): string {
  return String(Number(valor)).replace(".", ",");
}

type EscolhaProps<T extends string> = {
  titulo: string;
  opcoes: Array<{ valor: T; rotulo: string; detalhe: string }>;
  selecionado: T;
  aoSelecionar: (valor: T) => void;
};

/** Grade de escolha unica, com o preco visivel dentro da propria opcao. */
function Escolha<T extends string>({ titulo, opcoes, selecionado, aoSelecionar }: EscolhaProps<T>) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold tracking-wide text-tinta-suave uppercase">
        {titulo}
      </legend>
      <div className="grid grid-cols-2 gap-3">
        {opcoes.map((opcao) => {
          const ativo = opcao.valor === selecionado;
          return (
            <button
              key={opcao.valor}
              type="button"
              onClick={() => aoSelecionar(opcao.valor)}
              aria-pressed={ativo}
              className={`flex min-h-14 flex-col items-start justify-center rounded-lg border px-4 py-2.5 text-left transition-colors ${
                ativo
                  ? "border-marca bg-marca-suave"
                  : "border-borda bg-superficie hover:border-borda-forte"
              }`}
            >
              <span className={`text-sm font-medium ${ativo ? "text-marca" : "text-tinta"}`}>
                {opcao.rotulo}
              </span>
              <span className="text-sm text-tinta-suave tabular-nums">{opcao.detalhe}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

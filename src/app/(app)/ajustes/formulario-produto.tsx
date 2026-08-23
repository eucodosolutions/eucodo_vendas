"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useState } from "react";

import { removerProduto, salvarProduto, type EstadoAjustes } from "./actions";
import { useAviso } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo, CampoTexto } from "@/components/ui/campo";
import { Escolha } from "@/components/ui/escolha";
import { Secao } from "@/components/ui/secao";
import { CORES, DETALHE_DO_TIPO, TECNOLOGIAS, TIPOS } from "@/lib/catalogo";
import { moeda, ROTULO_COR, ROTULO_TECNOLOGIA, ROTULO_TIPO_PRODUTO } from "@/lib/formato";
import type { CorArte, TecnologiaArte, TipoProduto } from "@/types/database";

export type ProdutoEditavel = {
  id: string;
  tipo: TipoProduto;
  codigo: string;
  nome: string;
  descricao: string | null;
  foto_url: string | null;
  preco_centavos: number;
  comissao_percentual: number;
  prazo_entrega_dias: number;
  ativo: boolean;
  produto_avaliacao: {
    largura_mm: number;
    altura_mm: number;
    margem_seguranca_mm: number;
    sangria_mm: number;
    dpi: number;
    cores: CorArte[];
    tecnologias: TecnologiaArte[];
  } | null;
};

/**
 * Cadastro de produto, com os campos que o tipo pede e mais nenhum.
 *
 * O tipo so e escolhido na criacao. Trocar o tipo de um produto ja vendido nao
 * tem resposta boa: os itens antigos guardam o retrato do que foi vendido, e o
 * produto passaria a contradizer o proprio historico.
 */
export function FormularioProduto({
  produto,
  prazoPadrao,
}: {
  produto?: ProdutoEditavel;
  prazoPadrao: number;
}) {
  const [estado, acao] = useActionState<EstadoAjustes, FormData>(salvarProduto, {});
  const [estadoRemocao, acaoRemocao] = useActionState<EstadoAjustes, FormData>(removerProduto, {});

  useAviso(estado);
  useAviso(estadoRemocao);

  const [aberto, setAberto] = useState(!produto);
  const [tipo, setTipo] = useState<TipoProduto>(produto?.tipo ?? "avaliacao");
  const [foto, setFoto] = useState<string | null>(produto?.foto_url ?? null);

  const avaliacao = tipo === "avaliacao";
  const medidas = produto?.produto_avaliacao;

  if (!aberto && produto) {
    return (
      <Secao>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-base font-medium text-tinta">
              {produto.nome}
              {produto.ativo ? "" : " (fora da venda)"}
            </p>
            <p className="text-sm text-tinta-suave tabular-nums">
              {ROTULO_TIPO_PRODUTO[produto.tipo]} · {moeda(produto.preco_centavos)} ·{" "}
              {produto.comissao_percentual}% de comissão
            </p>
          </div>
          <Botao type="button" variante="secundario" onClick={() => setAberto(true)}>
            Editar
          </Botao>
        </div>
      </Secao>
    );
  }

  return (
    <Secao titulo={produto ? produto.nome : "Novo produto"}>
      <form action={acao} className="flex flex-col gap-5">
        {produto ? <input type="hidden" name="id" value={produto.id} /> : null}
        <input type="hidden" name="tipo" value={tipo} />

        {produto ? (
          <p className="text-sm text-tinta-suave">
            Tipo: <strong className="font-medium text-tinta">{ROTULO_TIPO_PRODUTO[tipo]}</strong>. O
            tipo não muda depois do cadastro.
          </p>
        ) : (
          <Escolha
            titulo="Tipo de produto"
            opcoes={TIPOS.map((valor) => ({
              valor,
              rotulo: ROTULO_TIPO_PRODUTO[valor],
              detalhe: DETALHE_DO_TIPO[valor],
            }))}
            selecionado={tipo}
            aoSelecionar={setTipo}
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Campo
            rotulo="Código"
            name="codigo"
            placeholder="A5"
            defaultValue={produto?.codigo}
            required
            ajuda="Curto, aparece no pedido."
          />
          <Campo
            rotulo="Nome"
            name="nome"
            placeholder="Display A5"
            defaultValue={produto?.nome}
            required
          />
          <Campo
            rotulo="Valor"
            name="preco"
            inputMode="decimal"
            placeholder="79,00"
            defaultValue={produto ? reais(produto.preco_centavos) : ""}
            required
          />
          <Campo
            rotulo="Comissão (%)"
            name="comissao"
            inputMode="decimal"
            placeholder="10"
            defaultValue={produto ? numero(produto.comissao_percentual) : "0"}
            required
            ajuda="Quanto o vendedor ganha por venda."
          />
          <Campo
            rotulo="Prazo de entrega (dias)"
            name="prazo"
            type="number"
            min={0}
            max={365}
            placeholder="3"
            defaultValue={produto?.prazo_entrega_dias ?? prazoPadrao}
            required
          />
          <label className="flex items-center gap-2 self-end pb-2.5 text-sm font-medium text-tinta">
            <input
              type="checkbox"
              name="ativo"
              defaultChecked={produto?.ativo ?? true}
              className="size-4 accent-marca"
            />
            Ativo na venda
          </label>
        </div>

        <CampoTexto
          rotulo="Descrição"
          name="descricao"
          placeholder="Camiseta em algodão, tamanhos P ao GG."
          defaultValue={produto?.descricao ?? ""}
          required={!avaliacao}
          ajuda={
            avaliacao
              ? "Opcional. A arte já mostra ao cliente o que ele leva."
              : "É o que o cliente lê para entender o que está comprando."
          }
        />

        {avaliacao ? (
          <fieldset className="border-t border-borda pt-4">
            <legend className="mb-3 text-xs font-semibold tracking-wide text-tinta-suave uppercase">
              Medidas da placa
            </legend>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Campo
                rotulo="Largura (mm)"
                name="largura"
                inputMode="decimal"
                placeholder="150"
                defaultValue={medidas ? numero(medidas.largura_mm) : ""}
                required
              />
              <Campo
                rotulo="Altura (mm)"
                name="altura"
                inputMode="decimal"
                placeholder="212"
                defaultValue={medidas ? numero(medidas.altura_mm) : ""}
                required
              />
              <Campo
                rotulo="Margem de segurança (mm)"
                name="margem"
                inputMode="decimal"
                placeholder="7"
                defaultValue={medidas ? numero(medidas.margem_seguranca_mm) : "7"}
                required
                ajuda="Área que a arte não invade."
              />
              <Campo
                rotulo="Sangria (mm)"
                name="sangria"
                inputMode="decimal"
                placeholder="0"
                defaultValue={medidas ? numero(medidas.sangria_mm) : "0"}
                required
                ajuda="O que a gráfica apara."
              />
              <Campo
                rotulo="DPI"
                name="dpi"
                type="number"
                min={72}
                max={1200}
                placeholder="300"
                defaultValue={medidas?.dpi ?? 300}
                required
              />
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Marcadores
                titulo="Cores oferecidas"
                nome="cores"
                opcoes={CORES.map((valor) => ({ valor, rotulo: ROTULO_COR[valor] }))}
                marcados={medidas?.cores ?? CORES}
              />
              <Marcadores
                titulo="Tecnologias oferecidas"
                nome="tecnologias"
                opcoes={TECNOLOGIAS.map((valor) => ({ valor, rotulo: ROTULO_TECNOLOGIA[valor] }))}
                marcados={medidas?.tecnologias ?? TECNOLOGIAS}
              />
            </div>
          </fieldset>
        ) : (
          <FotoDoProduto foto={foto} aoTrocar={setFoto} fotoAtual={produto?.foto_url ?? null} />
        )}

        <div className="flex flex-wrap justify-between gap-3">
          {produto ? (
            <Botao type="button" variante="fantasma" onClick={() => setAberto(false)}>
              Fechar
            </Botao>
          ) : (
            <span />
          )}
          <Botao type="submit" carregandoTexto="Salvando...">
            {produto ? "Salvar produto" : "Cadastrar produto"}
          </Botao>
        </div>
      </form>

      {produto ? (
        <form action={acaoRemocao} className="mt-4 flex justify-end border-t border-borda pt-4">
          <input type="hidden" name="id" value={produto.id} />
          <Botao type="submit" variante="fantasma" carregandoTexto="Removendo...">
            <Trash2 size={16} aria-hidden />
            Remover produto
          </Botao>
        </form>
      ) : null}
    </Secao>
  );
}

/** Foto do produto padrao, com previa local antes de subir. */
function FotoDoProduto({
  foto,
  fotoAtual,
  aoTrocar,
}: {
  foto: string | null;
  fotoAtual: string | null;
  aoTrocar: (url: string | null) => void;
}) {
  return (
    <fieldset className="border-t border-borda pt-4">
      <legend className="mb-3 text-xs font-semibold tracking-wide text-tinta-suave uppercase">
        Foto
      </legend>
      <div className="flex flex-wrap items-start gap-4">
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto} alt="" className="size-24 rounded-lg border border-borda object-cover" />
        ) : (
          <div className="flex size-24 items-center justify-center rounded-lg border border-dashed border-borda text-xs text-tinta-suave">
            Sem foto
          </div>
        )}
        <div className="flex-1">
          <label htmlFor="foto" className="text-rotulo font-medium text-tinta">
            Imagem do produto
          </label>
          <input
            id="foto"
            name="foto"
            type="file"
            accept="image/*"
            onChange={(evento) => {
              const arquivo = evento.target.files?.[0];
              aoTrocar(arquivo ? URL.createObjectURL(arquivo) : fotoAtual);
            }}
            className="mt-1.5 block w-full text-sm text-tinta-suave file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-borda file:bg-superficie file:px-3 file:py-2 file:text-sm file:font-medium file:text-tinta hover:file:border-borda-forte"
          />
          <p className="mt-1.5 text-xs text-tinta-suave">
            JPG ou PNG, até 5 MB. É a foto que o cliente vê na venda.
          </p>
        </div>
      </div>
    </fieldset>
  );
}

/** Lista de caixas de marcar, para os eixos que a placa oferece na venda. */
function Marcadores<T extends string>({
  titulo,
  nome,
  opcoes,
  marcados,
}: {
  titulo: string;
  nome: string;
  opcoes: Array<{ valor: T; rotulo: string }>;
  marcados: T[];
}) {
  return (
    <div>
      <p className="mb-2 text-rotulo font-medium text-tinta">{titulo}</p>
      <div className="flex flex-col gap-2">
        {opcoes.map((opcao) => (
          <label key={opcao.valor} className="flex items-center gap-2 text-sm text-tinta">
            <input
              type="checkbox"
              name={nome}
              value={opcao.valor}
              defaultChecked={marcados.includes(opcao.valor)}
              className="size-4 accent-marca"
            />
            {opcao.rotulo}
          </label>
        ))}
      </div>
    </div>
  );
}

function numero(valor: number): string {
  return String(Number(valor)).replace(".", ",");
}

function reais(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

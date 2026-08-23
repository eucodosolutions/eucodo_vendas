"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useState } from "react";

import { FotoDoProduto } from "./foto-do-produto";
import { removerProduto, salvarProduto, type EstadoProduto } from "./actions";
import { useAoDarCerto } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo, CampoTexto } from "@/components/ui/campo";
import { Confirmacao } from "@/components/ui/confirmacao";
import { Escolha } from "@/components/ui/escolha";
import { ModalDeFormulario } from "@/components/ui/modal-de-formulario";
import { Selecao } from "@/components/ui/selecao";
import {
  ACABAMENTO_PADRAO,
  CORES,
  DETALHE_DO_TIPO,
  TAMANHOS,
  TECNOLOGIAS,
  TIPOS,
  tamanhoDasMedidas,
  type TamanhoDePlaca,
} from "@/lib/catalogo";
import { ROTULO_COR, ROTULO_TECNOLOGIA, ROTULO_TIPO_PRODUTO } from "@/lib/formato";
import type { CorArte, TecnologiaArte, TipoProduto } from "@/types/database";

export type ProdutoEditavel = {
  id: string;
  tipo: TipoProduto;
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
    tecnologia: TecnologiaArte;
  } | null;
};

/** Prazo sugerido para produto novo. O prazo que vale e sempre o do produto. */
const PRAZO_SUGERIDO = 3;

const OPCOES_DE_TAMANHO = [
  ...(Object.keys(TAMANHOS) as Array<keyof typeof TAMANHOS>).map((chave) => ({
    valor: chave,
    texto: `${TAMANHOS[chave].rotulo} — ${TAMANHOS[chave].largura_mm} x ${TAMANHOS[chave].altura_mm} mm`,
  })),
  { valor: "personalizado", texto: "Personalizado" },
];

/**
 * Cadastro de produto em popup, na ordem em que a decisao acontece.
 *
 * Tipo, nome, o que a placa e (tamanho, medidas, cores, tecnologia) e so entao
 * quanto custa. A tela antiga misturava as tres coisas numa grade so, e o preco
 * aparecia antes de o produto estar definido.
 *
 * O tipo so e escolhido na criacao. Trocar o tipo de um produto ja vendido nao
 * tem resposta boa: os itens antigos guardam o retrato do que foi vendido, e o
 * produto passaria a contradizer o proprio historico.
 *
 * "Ativo na venda" nao mora aqui: produto nasce ativo e quem liga e desliga e o
 * interruptor da lista.
 */
export function ModalProduto({
  aberto,
  aoFechar,
  produto,
}: {
  aberto: boolean;
  aoFechar: () => void;
  produto?: ProdutoEditavel;
}) {
  const [estado, acao, salvando] = useActionState<EstadoProduto, FormData>(salvarProduto, {});
  const [estadoRemocao, acaoRemocao, removendo] = useActionState<EstadoProduto, FormData>(
    removerProduto,
    {},
  );

  const medidas = produto?.produto_avaliacao;

  const [tipo, setTipo] = useState<TipoProduto>(produto?.tipo ?? "avaliacao");
  const [tamanho, setTamanho] = useState<TamanhoDePlaca>(
    medidas ? tamanhoDasMedidas(medidas.largura_mm, medidas.altura_mm) : "a6",
  );
  const [foto, setFoto] = useState<string | null>(produto?.foto_url ?? null);
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);

  const avaliacao = tipo === "avaliacao";

  // Removido o produto, nao ha mais o que editar atras da confirmacao.
  useAoDarCerto(estadoRemocao, aoFechar);

  return (
    <>
      {/* O popup do cadastro fica montado atras da confirmacao, e nao e trocado
          por ela: quem desistir de remover volta com o formulario do jeito que
          deixou, e nao com os campos recarregados do zero. */}
      <ModalDeFormulario
        aberto={aberto}
        aoFechar={aoFechar}
        titulo={produto ? produto.nome : "Novo produto"}
        descricao={
          produto
            ? `${ROTULO_TIPO_PRODUTO[tipo]} · o tipo não muda depois do cadastro.`
            : undefined
        }
        tamanho="largo"
        acao={acao}
        estado={estado}
        pendente={salvando}
        salvarRotulo={produto ? "Salvar produto" : "Cadastrar produto"}
        acaoSecundaria={
          produto ? (
            <Botao
              type="button"
              variante="fantasma"
              onClick={() => setConfirmandoRemocao(true)}
              disabled={salvando}
            >
              <Trash2 size={16} aria-hidden />
              Remover
            </Botao>
          ) : undefined
        }
      >
        {produto ? <input type="hidden" name="id" value={produto.id} /> : null}
        <input type="hidden" name="tipo" value={tipo} />

        {produto ? null : (
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

        <Campo
          rotulo="Nome"
          name="nome"
          placeholder={avaliacao ? "Display A5 QR" : "Camiseta bordada"}
          defaultValue={produto?.nome}
          required
          ajuda={
            avaliacao
              ? "É o nome que o vendedor escolhe na venda. Diga o tamanho e a tecnologia."
              : "É o nome que o vendedor escolhe na venda."
          }
        />

        {avaliacao ? (
          <PlacaDeAvaliacao
            tamanho={tamanho}
            aoTrocarTamanho={setTamanho}
            medidas={medidas ?? null}
          />
        ) : (
          <>
            <CampoTexto
              rotulo="Descrição"
              name="descricao"
              placeholder="Camiseta em algodão, tamanhos P ao GG."
              defaultValue={produto?.descricao ?? ""}
              required
              ajuda="É o que o cliente lê para entender o que está comprando."
            />
            <FotoDoProduto foto={foto} aoTrocar={setFoto} fotoAtual={produto?.foto_url ?? null} />
          </>
        )}

        <fieldset className="border-t border-borda pt-4">
          <legend className="mb-3 text-xs font-semibold tracking-wide text-tinta-suave uppercase">
            Venda
          </legend>
          <div className="grid gap-4 sm:grid-cols-3">
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
              defaultValue={produto?.prazo_entrega_dias ?? PRAZO_SUGERIDO}
              required
              ajuda="O pedido sai quando o item mais lento fica pronto."
            />
          </div>
        </fieldset>
      </ModalDeFormulario>

      {produto ? (
        <Confirmacao
          aberto={confirmandoRemocao}
          aoFechar={() => setConfirmandoRemocao(false)}
          titulo={`Remover ${produto.nome}?`}
          mensagem="O produto sai do catálogo para sempre. Se ele já foi vendido, o sistema não deixa apagar: desligue-o na lista para tirá-lo da tela de venda sem perder o histórico."
          acao={acaoRemocao}
          estado={estadoRemocao}
          pendente={removendo}
          confirmarRotulo="Remover produto"
          carregandoTexto="Removendo..."
          ocultos={{ id: produto.id }}
        />
      ) : null}
    </>
  );
}

/**
 * O que so a placa tem: tamanho, medidas, cores e tecnologia.
 *
 * O tamanho vem antes das medidas porque e ele que decide se ha medida para
 * digitar. Em A6 e A5 os campos mostram as nossas, bloqueados; so
 * "personalizado" abre a digitacao, e ai aparecem tambem os numeros de grafica.
 */
function PlacaDeAvaliacao({
  tamanho,
  aoTrocarTamanho,
  medidas,
}: {
  tamanho: TamanhoDePlaca;
  aoTrocarTamanho: (valor: TamanhoDePlaca) => void;
  medidas: NonNullable<ProdutoEditavel["produto_avaliacao"]> | null;
}) {
  const proprio = tamanho === "personalizado";
  const preset = proprio ? null : TAMANHOS[tamanho];

  return (
    <>
      <Selecao
        rotulo="Tamanho"
        name="tamanho"
        opcoes={OPCOES_DE_TAMANHO}
        value={tamanho}
        onChange={(evento) => aoTrocarTamanho(evento.target.value as TamanhoDePlaca)}
      />

      {/* A `key` remonta os campos ao trocar de tamanho: os de A6 e A5 sao
          controlados pela constante e os de personalizado sao livres, e o React
          reclamaria de um virar o outro na mesma posicao. */}
      <div key={proprio ? "livre" : "fixo"} className="grid gap-4 sm:grid-cols-2">
        <Campo
          rotulo="Largura (mm)"
          name="largura"
          inputMode="decimal"
          placeholder="150"
          bloqueado={!proprio}
          {...(preset
            ? { value: preset.largura_mm }
            : { defaultValue: medidas ? numero(medidas.largura_mm) : "" })}
          required
          ajuda={preset ? `Medida do nosso display ${preset.rotulo}.` : undefined}
        />
        <Campo
          rotulo="Altura (mm)"
          name="altura"
          inputMode="decimal"
          placeholder="212"
          bloqueado={!proprio}
          {...(preset
            ? { value: preset.altura_mm }
            : { defaultValue: medidas ? numero(medidas.altura_mm) : "" })}
          required
          ajuda={preset ? "Para outra medida, escolha Personalizado." : undefined}
        />

        {proprio ? (
          <>
            <Campo
              rotulo="Margem de segurança (mm)"
              name="margem"
              inputMode="decimal"
              placeholder="7"
              defaultValue={numero(
                medidas?.margem_seguranca_mm ?? ACABAMENTO_PADRAO.margem_seguranca_mm,
              )}
              required
              ajuda="Área que a arte não invade."
            />
            <Campo
              rotulo="Sangria (mm)"
              name="sangria"
              inputMode="decimal"
              placeholder="0"
              defaultValue={numero(medidas?.sangria_mm ?? ACABAMENTO_PADRAO.sangria_mm)}
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
              defaultValue={medidas?.dpi ?? ACABAMENTO_PADRAO.dpi}
              required
            />
          </>
        ) : null}
      </div>

      <Cores marcadas={medidas?.cores ?? CORES} />

      <Selecao
        rotulo="Tecnologia"
        name="tecnologia"
        opcoes={TECNOLOGIAS.map((valor) => ({ valor, texto: ROTULO_TECNOLOGIA[valor] }))}
        defaultValue={medidas?.tecnologia ?? "qr"}
      />
    </>
  );
}

/**
 * As cores em que esta placa e vendida.
 *
 * Mais de uma, ao contrario da tecnologia: trocar branco por preto nao muda o
 * custo, entao a cor e escolha do cliente na venda e nao um produto a parte.
 */
function Cores({ marcadas }: { marcadas: CorArte[] }) {
  return (
    <div>
      <p className="mb-2 text-rotulo font-medium text-tinta">Cores</p>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {CORES.map((cor) => (
          <label key={cor} className="flex cursor-pointer items-center gap-2 text-sm text-tinta">
            <input
              type="checkbox"
              name="cores"
              value={cor}
              defaultChecked={marcadas.includes(cor)}
              className="size-4 accent-marca"
            />
            {ROTULO_COR[cor]}
          </label>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-tinta-suave">
        O cliente escolhe entre estas na hora da venda.
      </p>
    </div>
  );
}

function numero(valor: number): string {
  return String(Number(valor)).replace(".", ",");
}

function reais(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

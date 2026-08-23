"use client";

import { Loader2, MessageCircle, RefreshCw, Smartphone, Unplug } from "lucide-react";
import { use, useCallback, useEffect, useRef, useState } from "react";

import { avisar } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Confirmacao } from "@/components/ui/confirmacao";
import { Secao } from "@/components/ui/secao";
import { whatsappLegivel } from "@/lib/formato";
import {
  conectarWhatsapp,
  desconectarWhatsapp,
  verConexao,
  type Conexao,
  type EstadoDaConexao,
} from "@/lib/whatsapp/instancia";

/**
 * De quanto em quanto tempo a tela pergunta se ja parearam.
 *
 * O pareamento acontece no celular do assinante, e a uazapi nao avisa o painel
 * quando termina: perguntar e o unico jeito de saber. Tres segundos e o que
 * faz o "Conectado" aparecer junto com o aviso na tela do WhatsApp, sem virar
 * uma chamada por segundo enquanto a pessoa procura o menu do aparelho.
 */
const INTERVALO_DA_ESPERA = 3000;

/** O QR da uazapi vale dois minutos. Paramos junto com ele. */
const VALIDADE_DO_QR = 120000;

const ROTULO: Record<EstadoDaConexao, string> = {
  sem_instancia: "Não conectado",
  desconectado: "Desconectado",
  conectando: "Aguardando o celular",
  conectado: "Conectado",
  hibernado: "Em pausa",
};

/**
 * A conexao do WhatsApp da conta.
 *
 * A instancia e da plataforma: o assinante nao tem conta na uazapi, nao digita
 * host nem token, e nao deveria precisar saber que qualquer uma dessas coisas
 * existe. Da tela dele, conectar o WhatsApp e escanear um QR code — igual ao
 * WhatsApp Web, que e a unica referencia que ele tem para isto.
 *
 * Enquanto o QR esta na frente dele a tela pergunta o status sozinha, porque o
 * pareamento termina no celular e nada volta de la para ca. O relogio para no
 * fim da validade do codigo em vez de perguntar para sempre: um painel aberto
 * e esquecido numa aba nao tem por que bater na uazapi a tarde inteira.
 */
export function ConexaoWhatsapp({ inicial }: { inicial: Promise<Conexao> }) {
  // A primeira leitura vem do servidor, sem `await` na pagina: o Ajustes abre
  // na hora e esta secao chega em seguida, dentro do Suspense. Buscar isto num
  // efeito de montagem deixaria a mesma espera, so que depois do JS carregar —
  // e prenderia o PIX, que e o resto da tela, a uma uazapi lenta.
  const [conexao, setConexao] = useState<Conexao>(use(inicial));
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  // Guarda a hora em que o QR na tela expira. Em ref, e nao em estado, porque
  // quem le isso e o intervalo: virar estado religaria o efeito a cada tique.
  const expiraEm = useRef(0);

  const carregar = useCallback(async () => {
    const resposta = await verConexao();
    setConexao(resposta);
    if (resposta.erro) avisar.erro(resposta.erro);
  }, []);

  // A falha da primeira leitura vira toast como qualquer outra. So o aviso sai
  // daqui: o efeito nao mexe em estado nenhum, que e o que o deixa aceitavel.
  const erroInicial = conexao.erro;
  useEffect(() => {
    if (erroInicial) avisar.erro(erroInicial);
  }, [erroInicial]);

  const esperando = conexao.estado === "conectando";

  useEffect(() => {
    if (!esperando) return;

    // A tela pode ter aberto ja com um pareamento em curso — quem recarregou a
    // pagina com o QR na frente. Ai o relogio comeca aqui: quanto do prazo
    // original ja passou nao da para saber, e errar para mais custa um "Gerar
    // outro codigo", enquanto errar para menos apagaria da tela um codigo que
    // ainda funciona.
    if (expiraEm.current === 0) expiraEm.current = Date.now() + VALIDADE_DO_QR;

    const relogio = setInterval(async () => {
      if (Date.now() > expiraEm.current) {
        clearInterval(relogio);
        // O codigo venceu. Volta ao estado de antes, com o botao de gerar
        // outro, em vez de deixar na tela um QR que o celular vai recusar.
        setConexao((atual) => ({ ...atual, estado: "desconectado", qrcode: null, paircode: null }));
        return;
      }

      const resposta = await verConexao();
      // Um erro de rede no meio da espera nao derruba o QR da tela: o celular
      // do assinante pode estar terminando de parear neste exato momento.
      if (resposta.erro) return;

      // Pareou. O aviso sai daqui, e nao de um efeito olhando o estado, porque
      // so este caminho sabe que a conexao acabou de acontecer: entrar em
      // Ajustes com o WhatsApp ja conectado nao e novidade que mereca toast.
      if (resposta.estado === "conectado") {
        clearInterval(relogio);
        avisar.sucesso("WhatsApp conectado. As mensagens já saem sozinhas.");
      }

      setConexao(resposta);
    }, INTERVALO_DA_ESPERA);

    return () => clearInterval(relogio);
  }, [esperando]);

  async function pedirConexao() {
    setOcupado(true);
    const resposta = await conectarWhatsapp();
    setOcupado(false);

    if (resposta.erro) {
      avisar.erro(resposta.erro);
      // A instancia pode ter sido esquecida no meio do caminho; releia o estado
      // real em vez de deixar a tela mostrando o de antes.
      void carregar();
      return;
    }

    expiraEm.current = Date.now() + VALIDADE_DO_QR;
    setConexao(resposta);
  }

  async function soltarAparelho() {
    setOcupado(true);
    const resposta = await desconectarWhatsapp();
    setOcupado(false);
    setConfirmando(false);

    if (resposta.erro) {
      avisar.erro(resposta.erro);
      return;
    }

    setConexao(resposta);
    avisar.sucesso("WhatsApp desconectado. As mensagens voltam a sair por link.");
  }

  const conectado = conexao.estado === "conectado";

  return (
    <Secao titulo="WhatsApp" acao={<Situacao estado={conexao.estado} />}>
      <div className="flex flex-col gap-4">
        {conectado ? (
          <Conectado conexao={conexao} />
        ) : conexao.estado === "conectando" ? (
          <Pareando conexao={conexao} />
        ) : (
          <p className="text-sm text-tinta-media">
            Sem WhatsApp conectado, o painel não deixa de mandar nada: cada mensagem vira um
            botão que abre a conversa com o texto e a arte prontos, e você toca em enviar. Conectar
            é o que faz isso sair sozinho.
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          {conectado ? (
            <Botao
              type="button"
              variante="secundario"
              onClick={() => setConfirmando(true)}
              disabled={ocupado}
            >
              <Unplug size={16} aria-hidden />
              Desconectar
            </Botao>
          ) : (
            <Botao
              type="button"
              onClick={pedirConexao}
              disabled={ocupado}
              carregandoTexto="Gerando o código..."
            >
              {ocupado ? (
                <Loader2 size={16} aria-hidden className="animate-spin" />
              ) : conexao.estado === "conectando" ? (
                <RefreshCw size={16} aria-hidden />
              ) : (
                <MessageCircle size={16} aria-hidden />
              )}
              {ocupado
                ? "Gerando o código..."
                : conexao.estado === "conectando"
                  ? "Gerar outro código"
                  : "Conectar o WhatsApp"}
            </Botao>
          )}
        </div>
      </div>

      <Confirmacao
        aberto={confirmando}
        aoFechar={() => setConfirmando(false)}
        titulo="Desconectar o WhatsApp?"
        mensagem="O aparelho sai da conexão e as mensagens voltam a ser enviadas na mão, por link. Para religar é só escanear outro QR code."
        acao={() => void soltarAparelho()}
        estado={{}}
        pendente={ocupado}
        confirmarRotulo="Desconectar"
        carregandoTexto="Desconectando..."
      />
    </Secao>
  );
}

/**
 * O que fica no lugar enquanto a uazapi nao responde a primeira leitura.
 *
 * Tem a mesma moldura da secao pronta de proposito: o resto do Ajustes ja esta
 * na tela, e um bloco que muda de altura ao chegar empurraria o formulario de
 * PIX para baixo debaixo do cursor de quem ja comecou a digitar.
 */
export function ConexaoWhatsappCarregando() {
  return (
    <Secao titulo="WhatsApp">
      <div className="flex items-center gap-2 text-sm text-tinta-suave">
        <Loader2 size={16} aria-hidden className="animate-spin" />
        Vendo como está a conexão...
      </div>
    </Secao>
  );
}

/** A bolinha de status, no canto do titulo da secao. */
function Situacao({ estado }: { estado: EstadoDaConexao }) {
  const cor =
    estado === "conectado"
      ? "bg-sucesso"
      : estado === "conectando"
        ? "bg-atencao animate-pulse"
        : "bg-borda-forte";

  return (
    <span className="flex items-center gap-2 text-xs font-medium text-tinta-suave">
      <span className={`size-2 rounded-full ${cor}`} aria-hidden />
      {ROTULO[estado]}
    </span>
  );
}

function Conectado({ conexao }: { conexao: Conexao }) {
  const numero = conexao.numero ? whatsappLegivel(conexao.numero) : null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-sucesso bg-sucesso-suave px-3 py-2.5">
      <Smartphone size={16} aria-hidden className="mt-0.5 shrink-0 text-sucesso" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-tinta">
          {conexao.perfil || "WhatsApp conectado"}
        </p>
        <p className="text-xs text-tinta-suave">
          {numero ? `${numero} · as mensagens saem sozinhas` : "As mensagens saem sozinhas"}
        </p>
      </div>
    </div>
  );
}

function Pareando({ conexao }: { conexao: Conexao }) {
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      {conexao.qrcode ? (
        // Fundo branco na moldura, e nao so no PNG: alguns QR vem com fundo
        // transparente, e no tema escuro o leitor do celular nao acha o codigo.
        <div className="shrink-0 rounded-lg border border-borda bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={conexao.qrcode}
            alt="QR code para conectar o WhatsApp"
            className="size-[180px]"
          />
        </div>
      ) : conexao.paircode ? (
        <div className="shrink-0 rounded-lg border border-borda bg-papel px-4 py-3">
          <p className="text-xs text-tinta-suave">Código de pareamento</p>
          <p className="font-mono text-xl font-semibold tracking-widest text-tinta">
            {conexao.paircode}
          </p>
        </div>
      ) : (
        <div className="flex size-[180px] shrink-0 items-center justify-center rounded-lg border border-dashed border-borda-forte">
          <Loader2 size={20} aria-hidden className="animate-spin text-tinta-suave" />
        </div>
      )}

      <div className="text-sm text-tinta-media">
        <p className="font-medium text-tinta">No celular que vai mandar as mensagens:</p>
        <ol className="mt-2 flex list-decimal flex-col gap-1 pl-4 text-sm">
          <li>Abra o WhatsApp</li>
          <li>Toque nos três pontinhos e em Aparelhos conectados</li>
          <li>Toque em Conectar aparelho</li>
          <li>{conexao.paircode ? "Escolha conectar com número e digite o código" : "Aponte a câmera para o código ao lado"}</li>
        </ol>
        <p className="mt-3 flex items-center gap-2 text-xs text-tinta-suave">
          <Loader2 size={12} aria-hidden className="animate-spin" />
          O código vale dois minutos. Assim que você escanear, esta tela avisa.
        </p>
      </div>
    </div>
  );
}

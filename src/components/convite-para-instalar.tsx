"use client";

import { Share, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

const CHAVE_DISPENSA = "eucodo:convite-instalar-dispensado";

/** O evento do Chrome que deixa a pagina chamar a instalacao na hora que quiser. */
type EventoDeInstalacao = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Convite para instalar o painel como aplicativo.
 *
 * Dois caminhos, porque as plataformas nao se parecem: no Chrome da para pedir a
 * instalacao por codigo (`beforeinstallprompt`), no iOS nao existe evento nenhum
 * e o unico caminho e ensinar o gesto de compartilhar.
 *
 * Nao aparece para quem ja instalou nem para quem ja dispensou. As tres leituras
 * de ambiente entram por `useSyncExternalStore` porque sao valores do navegador
 * que o servidor nao tem: ele responde "esconde", e o cliente corrige no
 * primeiro render, sem efeito e sem render extra.
 */
export function ConviteParaInstalar() {
  const instalado = useSyncExternalStore(semMudanca, estaInstalado, () => true);
  const ehIOS = useSyncExternalStore(semMudanca, noIOS, () => false);
  const dispensadoAntes = useSyncExternalStore(semMudanca, leuDispensa, () => true);

  const [evento, setEvento] = useState<EventoDeInstalacao | null>(null);
  const [dispensadoAgora, setDispensadoAgora] = useState(false);

  useEffect(() => {
    function aoPoderInstalar(nativo: Event) {
      // Sem isto o Chrome mostra a barra dele, e ficariam dois convites na tela.
      nativo.preventDefault();
      setEvento(nativo as EventoDeInstalacao);
    }

    window.addEventListener("beforeinstallprompt", aoPoderInstalar);
    return () => window.removeEventListener("beforeinstallprompt", aoPoderInstalar);
  }, []);

  const escondido = instalado || dispensadoAntes || dispensadoAgora;
  if (escondido || (!ehIOS && !evento)) return null;

  function dispensar() {
    setDispensadoAgora(true);
    try {
      localStorage.setItem(CHAVE_DISPENSA, "1");
    } catch {
      // Navegador com armazenamento bloqueado: o convite volta na proxima visita.
    }
  }

  async function instalar() {
    if (!evento) return;
    await evento.prompt();
    await evento.userChoice;
    dispensar();
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+4.5rem)] md:right-4 md:bottom-4 md:left-auto md:w-96 md:px-0 md:pb-0">
      <div className="rounded-card border border-borda-forte bg-superficie p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-marca text-sm font-bold text-white">
            E
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-tinta">Instale o Eucodo Vendas</p>
            <p className="mt-0.5 text-xs text-tinta-suave">
              Abre direto da tela de início, sem passar pelo navegador.
            </p>

            {ehIOS ? (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-marca">
                <Share size={14} aria-hidden />
                Toque em Compartilhar e depois em Adicionar à Tela de Início
              </p>
            ) : (
              <button
                type="button"
                onClick={instalar}
                className="mt-3 inline-flex h-9 items-center rounded-lg bg-marca px-3 text-sm font-medium text-white transition-colors hover:bg-marca-escura"
              >
                Instalar
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={dispensar}
            aria-label="Dispensar convite"
            className="-m-1 flex size-8 items-center justify-center rounded-lg text-tinta-suave transition-colors hover:bg-papel hover:text-tinta"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Nenhuma destas leituras muda durante a sessao, entao nao ha o que assinar. */
function semMudanca(): () => void {
  return () => {};
}

function estaInstalado(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // O Safari nao implementa display-mode e usa esta propriedade sua.
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function noIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function leuDispensa(): boolean {
  try {
    return localStorage.getItem(CHAVE_DISPENSA) === "1";
  } catch {
    return false;
  }
}

"use client";

import { useEffect } from "react";

/**
 * Registra o service worker do PWA.
 *
 * So em producao: em desenvolvimento o worker guardaria resposta e o Joel
 * passaria a ver tela velha depois de cada alteracao, que e o pior jeito de
 * descobrir que existe um service worker no projeto.
 */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((erro) => {
      console.error("Não consegui registrar o service worker", erro);
    });
  }, []);

  return null;
}

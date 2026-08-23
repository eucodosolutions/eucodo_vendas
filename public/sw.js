// Service worker minimo do Eucodo Vendas.
//
// Ele existe por dois motivos, e nenhum deles e cache agressivo:
//   1. O Chrome so oferece instalar o app quando ha um service worker com
//      handler de `fetch` registrado.
//   2. Com o shell em cache, abrir o painel offline mostra a marca em vez do
//      dinossauro do navegador.
//
// O que ele NAO faz de proposito: guardar resposta de dado. Preco, pedido e
// cliente vem do servidor sempre. Painel de venda mostrando preco velho seria
// pior que painel que nao abre.

const CACHE = "eucodo-shell-v1";
const ESSENCIAIS = ["/icone-192.png"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ESSENCIAIS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) =>
        Promise.all(chaves.filter((chave) => chave !== CACHE).map((chave) => caches.delete(chave))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  const requisicao = evento.request;

  // So GET de mesma origem. POST de server action nunca passa por aqui.
  if (requisicao.method !== "GET") return;
  if (new URL(requisicao.url).origin !== self.location.origin) return;

  evento.respondWith(
    fetch(requisicao).catch(async () => {
      const guardado = await caches.match(requisicao);
      if (guardado) return guardado;

      return new Response("Sem conexão. Abra de novo quando a internet voltar.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }),
  );
});

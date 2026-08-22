import { LinkBotao } from "@/components/ui/link-botao";

export default function NaoEncontrado() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center px-5 py-16 text-center">
      <span className="font-mono text-sm font-medium tracking-widest text-tinta-suave">
        ERRO 404
      </span>
      <h1 className="mt-3 max-w-md text-2xl font-semibold tracking-tight text-tinta">
        Esta pagina nao existe
      </h1>
      <p className="mt-2 max-w-sm text-sm text-tinta-suave">
        O endereco pode ter mudado, ou o link que te trouxe aqui esta com erro de
        digitacao.
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <LinkBotao href="/vender">Ir para a venda rapida</LinkBotao>
        <LinkBotao href="/pedidos" variante="secundario">
          Ver pedidos
        </LinkBotao>
      </div>
    </main>
  );
}

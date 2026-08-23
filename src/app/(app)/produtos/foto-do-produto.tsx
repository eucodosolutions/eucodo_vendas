"use client";

/** Foto do produto padrao, com previa local antes de subir. */
export function FotoDoProduto({
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

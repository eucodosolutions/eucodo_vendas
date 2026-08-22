import type { InputHTMLAttributes, ReactNode } from "react";

type CampoProps = InputHTMLAttributes<HTMLInputElement> & {
  rotulo: string;
  ajuda?: ReactNode;
  erro?: string;
};

export function Campo({ rotulo, ajuda, erro, id, className = "", ...props }: CampoProps) {
  const campoId = id ?? props.name;
  const ajudaId = ajuda ? `${campoId}-ajuda` : undefined;
  const erroId = erro ? `${campoId}-erro` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={campoId} className="text-sm font-medium text-tinta">
        {rotulo}
      </label>
      <input
        {...props}
        id={campoId}
        aria-invalid={erro ? true : undefined}
        aria-describedby={[ajudaId, erroId].filter(Boolean).join(" ") || undefined}
        className={`h-12 rounded-lg border bg-superficie px-3.5 text-base text-tinta placeholder:text-tinta-suave/70 ${
          erro ? "border-erro" : "border-borda"
        } ${className}`}
      />
      {ajuda ? (
        <p id={ajudaId} className="text-xs text-tinta-suave">
          {ajuda}
        </p>
      ) : null}
      {erro ? (
        <p id={erroId} className="text-xs font-medium text-erro">
          {erro}
        </p>
      ) : null}
    </div>
  );
}

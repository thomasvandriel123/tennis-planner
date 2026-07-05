"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

// A submit button that first asks for confirmation in a small modal. Rendered
// inside a server-action <form>, so confirming just submits that form. Used
// for irreversible steps like opening a period, or deleting one (danger).

type Variant = "primary" | "danger";

const TRIGGER_CLASS: Record<Variant, string> = {
  primary: "rounded-md bg-court px-4 py-2 text-sm font-medium text-white hover:bg-court-dark",
  danger:
    "rounded-md border border-line px-3 py-1.5 text-sm font-medium text-clay hover:bg-clay/5",
};

const CONFIRM_CLASS: Record<Variant, string> = {
  primary: "rounded-md bg-court px-4 py-2 text-sm font-medium text-white hover:bg-court-dark disabled:opacity-50",
  danger: "rounded-md bg-clay px-4 py-2 text-sm font-medium text-white hover:bg-clay/90 disabled:opacity-50",
};

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel,
  variant,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: Variant;
  onCancel: () => void;
}) {
  const { pending } = useFormStatus();
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-md rounded-lg border border-line bg-background p-5 shadow-lg">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-foreground/70">{body}</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-md border border-line px-4 py-2 text-sm font-medium hover:bg-court/5 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button type="submit" disabled={pending} className={CONFIRM_CLASS[variant]}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmSubmitButton({
  label,
  title,
  body,
  confirmLabel,
  cancelLabel,
  variant = "primary",
}: {
  label: string;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  variant?: Variant;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={TRIGGER_CLASS[variant]}>
        {label}
      </button>
      {open && (
        <ConfirmDialog
          title={title}
          body={body}
          confirmLabel={confirmLabel}
          cancelLabel={cancelLabel}
          variant={variant}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  );
}

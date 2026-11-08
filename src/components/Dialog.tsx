import { type ReactNode, useEffect, useRef } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  label: string;
  className?: string;
  children: ReactNode;
};

/**
 * A native modal <dialog>: the browser provides the focus trap, Escape to close
 * and the inert background. Clicking the backdrop also closes it.
 */
export function Dialog({ open, onClose, label, className = "", children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop clicks are a mouse shortcut; keyboard users close with Escape
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={`dialog m-auto max-h-[min(80vh,720px)] w-[min(640px,calc(100%-2rem))] overflow-hidden rounded-3xl border border-white/10 bg-[#0c1220]/95 p-0 text-ink shadow-2xl shadow-black/60 backdrop:bg-black/55 backdrop:backdrop-blur-sm ${className}`}
    >
      {open && children}
    </dialog>
  );
}

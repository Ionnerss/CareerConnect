import type { ReactNode } from "react";
import { Pencil, Trash2, type LucideIcon } from "lucide-react";

/**
 * Shared styles for the profile page so every section looks the same.
 * Colours match the dashboard: navy #0E1726, blue #1D4ED8, page #F5F6F8.
 */
export const ui = {
  card: "rounded-2xl border border-[#E3E6EB] bg-white p-5 shadow-[0_10px_30px_-22px_rgba(14,23,38,0.35)] sm:p-6",
  label: "text-sm font-semibold text-[#1F2937]",
  input:
    "h-10 w-full rounded-xl border border-[#D9DEE5] bg-white px-3 text-sm text-[#0E1726] placeholder:text-[#9CA3AF] outline-none transition-colors focus:border-[#1D4ED8] focus:ring-3 focus:ring-[#1D4ED8]/15 aria-invalid:border-[#DC2626]",
  textarea:
    "w-full rounded-xl border border-[#D9DEE5] bg-white px-3 py-2 text-sm text-[#0E1726] placeholder:text-[#9CA3AF] outline-none transition-colors focus:border-[#1D4ED8] focus:ring-3 focus:ring-[#1D4ED8]/15 aria-invalid:border-[#DC2626]",
  fileInput:
    "block w-full text-sm text-[#4B5563] file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#E8EEFD] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#1D4ED8] hover:file:bg-[#DCE5FC]",
  fieldError: "text-sm font-medium text-[#DC2626]",
  form: "mt-4 space-y-4 rounded-xl border border-[#E3E6EB] bg-[#F9FAFB] p-4 sm:p-5",
  primaryButton:
    "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#1D4ED8] px-5 text-sm font-bold text-white transition-colors hover:bg-[#1E40AF] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]",
  secondaryButton:
    "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#D9DEE5] bg-white px-4 text-sm font-semibold text-[#1F2937] transition-colors hover:bg-[#F5F6F8] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]",
  addButton:
    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#C7D5FA] bg-[#F3F6FE] px-3 text-sm font-semibold text-[#1D4ED8] transition-colors hover:bg-[#E8EEFD] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]",
  iconButton:
    "inline-flex size-9 items-center justify-center rounded-lg text-[#6B7280] transition-colors hover:bg-[#F5F6F8] hover:text-[#0E1726] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]",
  dangerIconButton:
    "inline-flex size-9 items-center justify-center rounded-lg text-[#6B7280] transition-colors hover:bg-[#FEF2F2] hover:text-[#DC2626] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DC2626]",
  confirmButton:
    "inline-flex h-8 items-center rounded-lg bg-[#DC2626] px-3 text-xs font-bold text-white transition-colors hover:bg-[#B91C1C] disabled:opacity-60",
  keepButton:
    "inline-flex h-8 items-center rounded-lg border border-[#D9DEE5] bg-white px-3 text-xs font-semibold text-[#1F2937] hover:bg-[#F5F6F8] disabled:opacity-60",
  textLink:
    "inline-flex items-center gap-1 text-sm font-semibold text-[#1D4ED8] hover:text-[#1E40AF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]",
  success: "mt-4 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-2 text-sm font-medium text-[#047857]",
  error: "mt-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm font-medium text-[#B91C1C]",
  empty: "mt-4 rounded-xl border border-dashed border-[#D9DEE5] px-4 py-6 text-center text-sm text-[#6B7280]",
  entryTitle: "font-bold text-[#0E1726]",
  entrySubtitle: "text-sm font-medium text-[#1F2937]",
  entryMeta: "font-mono text-xs text-[#6B7280]",
  entryBody: "mt-2 whitespace-pre-line text-sm leading-relaxed text-[#4B5563]",
} as const;

/** Icon + title + optional action, used at the top of every section. */
export function SectionHeader({
  id,
  icon: Icon,
  title,
  action,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-9 items-center justify-center rounded-xl bg-[#E8EEFD] text-[#1D4ED8]"
        >
          <Icon className="size-[18px]" />
        </span>
        <h2 id={id} className="text-lg font-bold tracking-tight text-[#0E1726]">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

/** Coloured square with the first letter of a company or school. */
export function EntryBadge({ text }: { text: string }) {
  const letter = text.trim().charAt(0).toUpperCase() || "?";

  return (
    <span
      aria-hidden="true"
      className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#0E1726] text-base font-extrabold text-white"
    >
      {letter}
    </span>
  );
}

/** Edit / Delete icon buttons, switching to Confirm / Keep while a delete is pending. */
export function EntryActions({
  label,
  confirming,
  busy,
  onEdit,
  onDelete,
  onConfirm,
  onCancel,
}: {
  label: string;
  confirming: boolean;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (confirming) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden text-xs font-semibold text-[#B91C1C] sm:inline">Delete?</span>
        <button
          type="button"
          className={ui.confirmButton}
          disabled={busy}
          onClick={onConfirm}
          aria-label={`Confirm delete ${label}`}
        >
          {busy ? "Deleting..." : "Confirm"}
        </button>
        <button type="button" className={ui.keepButton} disabled={busy} onClick={onCancel}>
          Keep
        </button>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <button type="button" className={ui.iconButton} onClick={onEdit} aria-label={`Edit ${label}`}>
        <Pencil aria-hidden="true" className="size-4" />
      </button>
      <button
        type="button"
        className={ui.dangerIconButton}
        onClick={onDelete}
        aria-label={`Delete ${label}`}
      >
        <Trash2 aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

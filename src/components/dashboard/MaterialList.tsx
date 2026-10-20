import { useState } from "react";

import { kindLabel, sizeLabel, type Material } from "@/lib/firebase/materials";
import { formatDay } from "@/lib/progress/insights";

/** The shared list, for teachers (with Remove) and parents. */
export function MaterialList({
  items,
  open,
  onRemove,
  openError = "Couldn't open it. Please check the internet connection and try again.",
}: {
  items: Material[];
  /** Left out on preview pages, where nothing opens. */
  open?: ((m: Material) => Promise<string>) | undefined;
  onRemove?: ((m: Material) => void) | undefined;
  /** Shown when a file can't be opened. */
  openError?: string | undefined;
}) {
  const [opening, setOpening] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const go = (m: Material) => {
    if (!open) return setFailed(m.id);
    // Open the tab straight away, so phone browsers don't block it, then point it at the file.
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    setOpening(m.id);
    setFailed(null);
    open(m)
      .then((url) => {
        if (tab) tab.location.href = url;
        else location.assign(url);
      })
      .catch(() => {
        tab?.close();
        setFailed(m.id);
      })
      .finally(() => setOpening(null));
  };
  return (
    <ul className="pd-list">
      {items.map((m) => (
        <li key={m.id} className="pd-item pd-material">
          <div className="pd-item-head">
            <strong>{m.title}</strong>
            <span className="pd-kind">{kindLabel[m.kind] ?? "Other"}</span>
          </div>
          {m.description && <span>{m.description}</span>}
          <span className="pd-muted">
            {m.teacherName}
            {m.createdAt &&
              ` · ${formatDay(new Date(m.createdAt.toMillis()).toISOString().slice(0, 10))}`}
            {m.file ? ` · ${m.file.name}, ${sizeLabel(m.file.size)}` : " · Link"}
          </span>
          <div className="pd-actions">
            <button
              type="button"
              className="pd-link"
              disabled={opening === m.id}
              onClick={() => go(m)}
            >
              {opening === m.id ? "Opening…" : m.file ? "Open or download" : "Open link"}
            </button>
            {onRemove && (
              <button type="button" className="pd-link" onClick={() => onRemove(m)}>
                Remove
              </button>
            )}
          </div>
          {failed === m.id && (
            <span className="pd-alert" role="alert">
              {openError}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

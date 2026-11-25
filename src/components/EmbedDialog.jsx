import { useState } from "react";
import { Check, Copy, X } from "lucide-react";

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

export default function EmbedDialog({ item, entity, onClose }) {
  const [view, setView] = useState("ani");
  const [compact, setCompact] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");

  const slug = item.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const route = entity === "director" ? `/directors/${slug}-${item.id}` : `/${slug}-${item.id}`;
  const url = new URL(`${route}/${view}`, window.location.origin);
  if (view === "ani" && compact) url.searchParams.set("compact", "true");

  const iframeId = `ani-index-${entity}-${item.id}`;
  const height = view === "details" ? 390 : compact ? 86 : 100;
  const code = [
    `<iframe`,
    `  id="${iframeId}"`,
    `  src="${escapeHtml(url.toString())}"`,
    `  width="100%"`,
    `  height="${height}"`,
    `  style="border:0;overflow:hidden"`,
    `  loading="lazy"`,
    `  title="ANI Index — ${escapeHtml(item.name)}"`,
    `></iframe>`,
    `<script>`,
    `window.addEventListener("message", function (event) {`,
    `  if (event.origin !== "${escapeHtml(url.origin)}") return;`,
    `  if (event.data?.type !== "ani-embed-resize" || event.data.id !== ${Number(item.id)}) return;`,
    `  var frame = document.getElementById("${iframeId}");`,
    `  if (frame && Number.isFinite(event.data.height)) frame.style.height = event.data.height + "px";`,
    `});`,
    `</script>`
  ].join("\n");

  async function copyCode() {
    setCopied(false);
    setCopyError("");
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch (error) {
      setCopyError(`No se pudo copiar automáticamente. Selecciona y copia el código manualmente. ${error.message}`);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-3 sm:p-5" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="embed-dialog-title"
        className="w-full max-w-xl rounded-2xl border border-line bg-coal p-5 shadow-2xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="embed-dialog-title" className="text-xl font-extrabold text-white">Embed {entity}</h2>
            <p className="mt-1 text-sm text-slate-400">Copia este código y pégalo en tu web.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-full border border-line p-2 text-slate-300 hover:bg-card hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Formato del embed">
          {[
            ["ani", "Insignia"],
            ["details", "Desglose"]
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              onClick={() => { setView(value); setCopied(false); }}
              className={`rounded-full border px-4 py-2 text-sm font-bold transition ${view === value ? "border-sky-400 bg-sky-400/15 text-sky-300" : "border-line text-slate-300 hover:text-white"}`}
            >
              {label}
            </button>
          ))}
          {view === "ani" && (
            <label className="ml-auto inline-flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={compact} onChange={(event) => { setCompact(event.target.checked); setCopied(false); }} />
              Compacto
            </label>
          )}
        </div>

        <textarea
          readOnly
          aria-label="Código iframe"
          value={code}
          onFocus={(event) => event.target.select()}
          className="mt-4 h-48 w-full resize-y rounded-xl border border-line bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-200 focus:border-sky-400 focus:outline-none"
        />
        {copyError && <p role="alert" className="mt-2 text-sm text-red-300">{copyError}</p>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <a href={url.toString()} target="_blank" rel="noreferrer" className="break-all text-xs text-sky-300 underline underline-offset-2">
            {url.toString()}
          </a>
          <button
            type="button"
            onClick={copyCode}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-sky-400 px-4 py-2.5 text-sm font-extrabold text-sky-950 hover:bg-sky-300"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Copiado" : "Copiar código"}
          </button>
        </div>
      </section>
    </div>
  );
}

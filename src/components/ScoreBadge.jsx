export default function ScoreBadge({ score, size = 56 }) {
  const s = Math.round(score);
  const label = { width: size, height: size, fontSize: size * 0.4 };

  if (s >= 90) {
    return (
      <div className="relative grid place-items-center" style={{ width: size * 1.1, height: size * 1.1 }} aria-label={`Score ${s}, Diamond`}>
        <svg viewBox="0 0 100 100" className="gem absolute inset-0 h-full w-full">
          <defs>
            <clipPath id="gemclip"><polygon points="50,2 96,34 50,98 4,34" /></clipPath>
          </defs>
          <polygon points="50,2 96,34 50,98 4,34" fill="#0284C7" />
          <g clipPath="url(#gemclip)">
            <polygon points="50,2 96,34 50,34" fill="#E0F2FE" />
            <polygon points="50,2 4,34 50,34" fill="#7DD3FC" />
            <polygon points="4,34 50,34 50,98" fill="#38BDF8" />
            <polygon points="96,34 50,34 50,98" fill="#0284C7" />
            <polygon points="30,34 50,34 50,98" fill="#0EA5E9" opacity=".55" />
            <polygon points="70,34 50,34 50,98" fill="#075985" opacity=".35" />
            <rect className="gem-sweep" x="-20" y="0" width="22" height="100" fill="#fff" opacity=".55" transform="skewX(-20)" />
          </g>
          <polygon points="50,2 96,34 50,98 4,34" fill="none" stroke="#E0F2FE" strokeWidth="2" />
        </svg>
        <span className="relative font-extrabold text-sky-950" style={{ fontSize: size * 0.32, marginTop: size * 0.06 }}>{s}</span>
      </div>
    );
  }

  let bg = "#DC2626", color = "#fff";
  if (s >= 80) { bg = "linear-gradient(145deg,#FDE047,#CA8A04)"; color = "#2B1B00"; }
  else if (s >= 60) { bg = "linear-gradient(145deg,#E2E8F0,#64748B)"; color = "#0F172A"; }
  else if (s >= 40) { bg = "linear-gradient(145deg,#B45309,#78350F)"; }

  return (
    <div className="grid place-items-center rounded-full font-extrabold shadow-lg ring-1 ring-black/30"
         style={{ ...label, background: bg, color }} aria-label={`Score ${s}`}>
      {s}
    </div>
  );
}

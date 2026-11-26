import { formatAniScore } from "../utils/aniScore.js";

export default function ScoreBadge({ score, size = 56, isDetailed = false }) {
  const s = Number(score);
  const formattedScore = formatAniScore(score, isDetailed);
  const badgeLabel = { width: size, height: size, fontSize: size * 0.4 };
  const textSize = isDetailed ? size * 0.26 : size * 0.32;

  if (s >= 93) {
    return (
      <div className="relative grid place-items-center" style={{ width: size * 1.1, height: size * 1.1 }} aria-label={`Score ${formattedScore}, Pure Diamond`}>
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
        <span className="relative font-extrabold text-sky-950" style={{ fontSize: textSize, marginTop: size * 0.06 }}>{formattedScore}</span>
      </div>
    );
  }

  let bg = "#DC2626", color = "#fff";
  let badgeStyle = {};
  if (s >= 90) {
    bg = "linear-gradient(145deg,#E0F2FE,#7DD3FC 52%,#38BDF8)";
    color = "#082F49";
    badgeStyle = { border: "1px solid rgba(224,242,254,.9)", boxShadow: "0 0 10px rgba(56,189,248,.35), inset 0 0 5px rgba(255,255,255,.55)" };
  } else if (s >= 80) { bg = "linear-gradient(145deg,#FDE047,#CA8A04)"; color = "#2B1B00"; }
  else if (s >= 60) { bg = "linear-gradient(145deg,#E2E8F0,#64748B)"; color = "#0F172A"; }
  else if (s >= 40) { bg = "linear-gradient(145deg,#B45309,#78350F)"; }

  return (
    <div className="grid place-items-center rounded-full font-extrabold shadow-lg ring-1 ring-black/30"
         style={{ ...badgeLabel, ...badgeStyle, fontSize: textSize, background: bg, color }} aria-label={`Score ${formattedScore}${s >= 90 ? ", Pseudodiamond" : ""}`}>
      {formattedScore}
    </div>
  );
}

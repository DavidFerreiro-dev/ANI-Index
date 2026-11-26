import { useEffect, useState } from "react";
import { X, Award, Film, DollarSign, MessageSquare, Compass, BookOpen, Layers } from "lucide-react";
import ScoreBadge from "./ScoreBadge.jsx";

const FALLBACK = {
  SCORING_VERSION: "26.2",
  WEIGHTS: { quality: 0.40, awards: 0.30, versatility: 0.10, sentiment: 0.10, commercial: 0.10 },
  BAYESIAN: { C: 6.5, m: 200, shrinkageK: 3 },
  QUALITY: { minimum: 6.0, maximum: 7.8, manyMaxWorks: 8, finalScoreCap: 100 },
  FILMOGRAPHY_WORKS: { few: 6, many: 14 },
  DIRECTOR_MULTIPLIER: 1.25,
  VOTING_THRESHOLD: 50,
  VERSATILITY_MAX_GROUPS: 6,
};

const LEGEND = [
  [20, "0–39 Red"],
  [50, "40–59 Bronze"],
  [70, "60–79 Silver"],
  [85, "80–89 Gold"],
  [100, "90–100 Diamond"]
];

export default function CriteriaModal({ onClose, mode = "Actors" }) {
  const [activeTab, setActiveTab] = useState(mode);
  const [config, setConfig] = useState(FALLBACK);

  useEffect(() => {
    fetch("/api/config")
      .then((response) => response.ok ? response.json() : FALLBACK)
      .then(setConfig)
      .catch(() => setConfig(FALLBACK));
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-auto bg-black/80 p-2 sm:p-4 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Criteria" onClick={(event) => event.stopPropagation()}
           className="relative my-4 sm:my-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-3xl border border-line bg-coal p-5 text-sm leading-relaxed text-slate-300 sm:p-8 shadow-2xl scroll-smooth">
        <button onClick={onClose} aria-label="Close" className="sticky top-0 float-right -mr-1 -mt-1 sm:-mr-2 sm:-mt-2 z-20 rounded-full bg-coal/90 p-2 text-slate-400 hover:text-white hover:bg-card border border-line/50 transition">
          <X size={20} />
        </button>

        <div className="flex flex-col gap-1 pr-8">
          <span className="text-xs font-bold uppercase tracking-wider text-sky-400">Artistic &amp; Narrative Index</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">ANI Index — Full Criteria &amp; Mathematical Specifications</h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Complete technical documentation, formulas, and calibration rules powering the cinematic evaluation engine.
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="mt-5 inline-flex max-w-full rounded-xl border border-line bg-card/60 p-1" role="tablist">
          <button role="tab" aria-selected={activeTab === "Actors"} onClick={() => setActiveTab("Actors")}
                  className={`rounded-lg px-4 py-2 text-xs sm:text-sm font-bold transition ${activeTab === "Actors" ? "bg-sky-400 text-sky-950 shadow" : "text-slate-300 hover:text-white"}`}>
            ANI Index — Actors (v26)
          </button>
          <button role="tab" aria-selected={activeTab === "Directors"} onClick={() => setActiveTab("Directors")}
                  className={`rounded-lg px-4 py-2 text-xs sm:text-sm font-bold transition ${activeTab === "Directors" ? "bg-sky-400 text-sky-950 shadow" : "text-slate-300 hover:text-white"}`}>
            ANI Index — Directors (v5)
          </button>
        </div>

        {activeTab === "Directors" ? (
          /* ========================================================================= */
          /*                           DIRECTORS CRITERIA (v5)                           */
          /* ========================================================================= */
          <div className="mt-6 space-y-6">
            <div className="rounded-xl border border-sky-500/20 bg-sky-950/20 p-4 text-xs sm:text-sm text-sky-200">
              <strong className="text-sky-300">Model Definition:</strong> Director Scoring version 5 evaluates feature films, TV series, and miniseries under a unified <strong>60% IMDb / 40% TMDb</strong> dual-source Bayesian engine across five pillars: Filmography Quality &amp; Consistency (40%), Awards &amp; Festivals Prestige (25%), Commercial Impact (15%), Authorship &amp; Versatility (10%), and Cultural Legacy (10%).
            </div>

            {/* Pillar Breakdown Table */}
            <div className="overflow-x-auto rounded-xl border border-line bg-card/40">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="border-b border-line bg-card/80 text-slate-200 font-bold">
                  <tr>
                    <th className="p-3">Pillar</th>
                    <th className="p-3">Weight</th>
                    <th className="p-3">Core Focus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/40 text-slate-300">
                  <tr>
                    <td className="p-3 font-semibold text-white">Filmography Quality &amp; Consistency</td>
                    <td className="p-3 font-bold text-sky-300">40%</td>
                    <td className="p-3">Peak (Top 4, 70%, max 1/saga) + Consistency (capped sliding window 6–12, 30%, max 2/saga)</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Awards &amp; Festivals Prestige</td>
                    <td className="p-3 font-bold text-sky-300">25%</td>
                    <td className="p-3">Oscars, Cannes, Venice, Berlin, BAFTA, DGA, César, Goya, Independent Spirit</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Commercial Impact</td>
                    <td className="p-3 font-bold text-sky-300">15%</td>
                    <td className="p-3">Top 3 post-1980 commercial features (70% log gross + 30% ROI, 1.10× standalone bonus)</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Authorship &amp; Versatility</td>
                    <td className="p-3 font-bold text-sky-300">10%</td>
                    <td className="p-3">75% Genre coverage (rating ≥ 6.5) + 25% Authorship index (screenplay/writer credits)</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Cultural Legacy</td>
                    <td className="p-3 font-bold text-sky-300">10%</td>
                    <td className="p-3">Logarithmic vote count calibration over Top 5 most-voted features</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 1. Overall Score Calculation */}
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Layers size={18} className="text-sky-400" /> Overall Score &amp; Asymmetric Continuous Weighting
              </h3>
              <p className="mt-1 text-slate-300">
                The four structural pillars are normalized into a Base Score (summing to 75% total base weight):
              </p>
              <div className="mt-2 rounded-lg bg-card/60 p-3 font-mono text-xs text-sky-200">
                Base Score = (40 × Quality + 15 × Commercial + 10 × Versatility + 10 × Legacy) / 75
              </div>
              <p className="mt-2 text-slate-300">
                Awards Prestige integrates through continuous asymmetric scaling to prevent inflation while recognizing historic accolades:
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li><strong>When Awards ≥ Base Score:</strong> <code className="text-sky-300 font-mono">Overall = 0.75 × Base + 0.25 × Awards</code></li>
                <li><strong>When Awards &lt; Base Score:</strong> <code className="text-sky-300 font-mono">Overall = 0.95 × Base + 0.05 × Awards</code> (protects auteur consistency when festival prizes are sparse).</li>
              </ul>
            </div>

            {/* 2. Filmography Quality & Consistency */}
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Film size={18} className="text-sky-400" /> Filmography Quality &amp; Consistency (40%)
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li><strong>Eligibility:</strong> Feature films directed by the person with runtime ≥ 60 minutes, status Released, excluding adult, video, and documentaries (genre 99). Minimum 3 valid feature films required to rank.</li>
                <li><strong>Bayesian Prior per movie:</strong> <code className="text-sky-300 font-mono">Bayes = (v / (v + 200)) × vote_average + (200 / (v + 200)) × 6.5</code>, dampening small vote samples.</li>
                <li><strong>Peak / Techo (60% of pillar):</strong> Calculated from the director's <strong>Top 4 valid features</strong>, capped at a strict <strong>maximum of 1 film per franchise/saga</strong> (choosing the highest-rated entry).</li>
                <li><strong>Consistency (30% of pillar):</strong> Calculated over a <strong>capped 6–12 film sliding window</strong> that scales with career length, capped at a maximum of <strong>2 films per franchise/saga</strong>.</li>
                <li><strong>Hardened Normalization (divisor 2.35):</strong>
                  <div className="my-1.5 rounded-lg bg-card/60 p-2 font-mono text-xs text-sky-200">
                    Normalized = clamp(((Bayes - 6.0) / 2.35) × 100)
                  </div>
                  Pillar Score = <code className="text-sky-300 font-mono">0.60 × PeakNormalized + 0.40 × ConsistencyNormalized</code>. This calibration ensures all-time directing peaks hover in the realistic 93–95 range (e.g., Miyazaki 94, Tarantino 93).
                </li>
              </ul>
            </div>

            {/* 3. Awards & Festivals Prestige */}
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Award size={18} className="text-sky-400" /> Awards &amp; Festivals Prestige (25%)
              </h3>
              <p className="mt-1">
                Evaluates directing, picture/film, and writing honors extracted via Wikidata with automatic deduplication across award, work, and year:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li><strong>Tier S (Won 28 / Nom 10):</strong> Academy Awards (Best Director, Best Picture, Screenplay), Cannes Palme d'Or, Venice Golden Lion, Berlin Golden Bear.</li>
                <li><strong>Tier A (Won 14 / Nom 5):</strong> BAFTA, Directors Guild of America (DGA), Golden Globes, Critics Choice, César, Goya, Cannes/Venice/Berlin Best Director prizes.</li>
                <li><strong>Tier B (Won 5 / Nom 1.5):</strong> Independent Spirit, Gotham, BIFA, National Board of Review, NYFCC, LAFCA, NSFC, Saturn Awards, Satellite.</li>
                <li><strong>Logarithmic Curve:</strong> <code className="text-sky-300 font-mono">Score = min(100, ln(1 + Points) × 100 / ln(91))</code>.</li>
              </ul>
            </div>

            {/* 4. Commercial Impact */}
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <DollarSign size={18} className="text-sky-400" /> Commercial Impact (15%)
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Evaluates the director's <strong>Top 3 commercial features</strong> (released in 1980 or later with verified gross revenue &gt; 0).</li>
                <li><strong>Franchise Cap:</strong> Maximum 1 film per franchise/saga (the highest-grossing representative).</li>
                <li><strong>Formula:</strong> Combines logarithmic worldwide gross (70%) and revenue-to-budget ROI (30%):
                  <div className="my-1.5 rounded-lg bg-card/60 p-2 font-mono text-xs text-sky-200">
                    Gross = clamp(((log10(Revenue) - 7) / 2) × 100); ROI = clamp((log10(Revenue / Budget) / 1) × 100)
                  </div>
                </li>
                <li><strong>Standalone Original Film Bonus:</strong> Non-franchise original features receive a <strong>1.10× multiplier</strong> (capped at 100) to reward original risk-taking over IP exploitation.</li>
                <li>Pre-1980 directors with unavailable budget/box office receive a conservative baseline of 70.</li>
              </ul>
            </div>

            {/* 5. Authorship & Versatility */}
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Compass size={18} className="text-sky-400" /> Authorship &amp; Versatility (10%)
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li><strong>Genre Versatility (75% of pillar):</strong> Counts distinct grouped genres where the director has released works rated ≥ 6.5 (out of 6 max genre families: Action/Adventure, Crime/Thriller/Mystery, Sci-Fi/Fantasy, Romance/Drama, Animation, Family).</li>
                <li><strong>Authorship Index (25% of pillar):</strong> Percentage of valid feature films where the director also holds a writing credit (<code className="text-sky-300 font-mono">Writer</code>, <code className="text-sky-300 font-mono">Screenplay</code>, or <code className="text-sky-300 font-mono">Story</code>).</li>
                <li><strong>Pillar Score:</strong> <code className="text-sky-300 font-mono">0.75 × GenreVersatility + 0.25 × AuthorshipIndex</code>.</li>
              </ul>
            </div>

            {/* 6. Cultural Legacy */}
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <BookOpen size={18} className="text-sky-400" /> Cultural Legacy (10%)
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Evaluates long-term global resonance and sustained audience engagement based on TMDb vote counts across the director's <strong>Top 5 most-voted feature films</strong>.</li>
                <li>Logarithmic piecewise scale:
                  <div className="my-1.5 rounded-lg bg-card/60 p-2 font-mono text-xs text-sky-200">
                    If votes ≤ 1,000: clamp((log10(max(votes, 10)) / 3) × 85)<br />
                    If votes &gt; 1,000: clamp(85 + ((log10(votes) - 3) / 3) × 15)
                  </div>
                </li>
                <li>Calibrated so historic canonical classics and modern cultural touchstones reach 88–95 without demanding billion-dollar blockbuster vote volumes.</li>
              </ul>
            </div>

            {/* TV & Hybrid Source Rules (v5) */}
            <div className="rounded-xl border border-line/70 bg-card/40 p-4 text-xs sm:text-sm space-y-1.5">
              <div className="font-bold text-white">TV Series, Miniseries &amp; Dual-Source Blending (v5)</div>
              <ul className="list-disc space-y-1 pl-5 text-slate-300">
                <li><strong>60% IMDb / 40% TMDb:</strong> Each eligible film, TV series, and miniseries blends Bayesian priors from IMDb (60%) and TMDb (40%), falling back automatically to 100% TMDb when a new release has not yet reached the daily IMDb dataset threshold.</li>
                <li><strong>Episode Thresholds:</strong> Regular TV series require <code className="text-sky-300 font-mono">episode_count ≥ 2</code> directed; miniseries (<code className="text-sky-300 font-mono">type === "Miniseries"</code>) require <code className="text-sky-300 font-mono">episode_count ≥ 1</code>.</li>
                <li><strong>Franchise / Series Cap:</strong> All directed episodes of the same TV series are grouped under a single series identity so one show cannot monopolize the Top 4 Peak or Consistency window.</li>
                <li><strong>Non-Fictional Exclusions:</strong> Documentary (<code className="text-sky-300 font-mono">99</code>), News (<code className="text-sky-300 font-mono">10763</code>), Reality (<code className="text-sky-300 font-mono">10764</code>), Talk Show (<code className="text-sky-300 font-mono">10767</code>), Game-Show, and standalone episodes (<code className="text-sky-300 font-mono">tvEpisode</code>) are strictly excluded.</li>
              </ul>
            </div>

            <p className="mt-6 border-t border-line pt-4 text-xs text-slate-500 flex items-center justify-between">
              <span>ANI Index — Directors v5</span>
              <a href="/docs" target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">Full Technical Docs →</a>
            </p>
          </div>
        ) : (
          /* ========================================================================= */
          /*                              ACTORS CRITERIA (v26)                          */
          /* ========================================================================= */
          <div className="mt-6 space-y-6">
            <div className="rounded-xl border border-sky-500/20 bg-sky-950/20 p-4 text-xs sm:text-sm text-sky-200">
              <strong className="text-sky-300">Model Definition:</strong> Actor Scoring version 26 evaluates acting careers across cinema, TV series, and miniseries under a unified <strong>60% IMDb / 40% TMDb</strong> Bayesian engine: Filmography Quality (40%), Awards Prestige (30%), Commercial Impact (10%), Critical Sentiment (10%), and Genre Versatility (10%).
            </div>

            {/* TV & Hybrid Source Rules (v26) */}
            <div className="rounded-xl border border-line/70 bg-card/40 p-4 text-xs sm:text-sm space-y-1.5">
              <div className="font-bold text-white">TV Series, Miniseries &amp; Dual-Source Blending (v26)</div>
              <ul className="list-disc space-y-1 pl-5 text-slate-300">
                <li><strong>60% IMDb / 40% TMDb:</strong> Film and TV works blend IMDb (60%) and TMDb (40%) Bayesian priors (<code className="text-sky-300 font-mono">C = 6.5, m = 200</code>), with instant 100% TMDb fallback for brand-new releases.</li>
                <li><strong>TV Episode Threshold:</strong> Series (<code className="text-sky-300 font-mono">tvSeries</code> / <code className="text-sky-300 font-mono">tvMiniSeries</code>) require <code className="text-sky-300 font-mono">episode_count ≥ 3</code> to prevent 1-episode guest cameos from distorting career metrics while capturing lead, recurring, and miniseries roles.</li>
                <li><strong>Strict Exclusions:</strong> Documentary (<code className="text-sky-300 font-mono">99</code>), News (<code className="text-sky-300 font-mono">10763</code>), Reality (<code className="text-sky-300 font-mono">10764</code>), Talk Show (<code className="text-sky-300 font-mono">10767</code>), Game-Show, TV Movie (<code className="text-sky-300 font-mono">10770</code>), voice-only roles, <code className="text-sky-300 font-mono">tvEpisode</code>, non-fictional credits (<code className="text-sky-300 font-mono">Self/Himself/Herself/Narrator/Host/Guest/Contestant</code>), and wrestling/MMA events (WWE, UFC, WrestleMania, etc.) are discarded.</li>
              </ul>
            </div>

            {/* Pillar Breakdown Table */}
            <div className="overflow-x-auto rounded-xl border border-line bg-card/40">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="border-b border-line bg-card/80 text-slate-200 font-bold">
                  <tr>
                    <th className="p-3">Pillar</th>
                    <th className="p-3">Weight</th>
                    <th className="p-3">Core Focus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/40 text-slate-300">
                  <tr>
                    <td className="p-3 font-semibold text-white">Filmography Quality</td>
                    <td className="p-3 font-bold text-sky-300">40%</td>
                    <td className="p-3">Continuous sliding window (6 to 8 works, max 2/saga); short career dampening (top 5, 1.35× Lead weight)</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Awards Prestige</td>
                    <td className="p-3 font-bold text-sky-300">30%</td>
                    <td className="p-3">Oscars, BAFTA, Cannes, Venice, Berlin, Golden Globes, SAG; Tier B cap (15 pts) &amp; micro-score (+0.5 pts, cap 10)</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Commercial Impact</td>
                    <td className="p-3 font-bold text-sky-300">10%</td>
                    <td className="p-3">Top 5 post-1980 commercial features (90% decade-adjusted log gross + 10% capped ROI, max 1/saga)</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Critical Sentiment</td>
                    <td className="p-3 font-bold text-sky-300">10%</td>
                    <td className="p-3">VADER polarity on actor/character review sentences (neutralized cinema descriptors)</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Genre Versatility</td>
                    <td className="p-3 font-bold text-sky-300">10%</td>
                    <td className="p-3">Grouped genre diversity across credited roles with billing order ≤ 3 and rating ≥ 6.5</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 1. Overall Score & Asymmetric Brake */}
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Layers size={18} className="text-sky-400" /> Overall Score &amp; Asymmetric Continuous Weighting
              </h3>
              <p className="mt-1 text-slate-300">
                The four structural pillars (Quality 40%, Versatility 10%, Sentiment 10%, Commercial 10%) are normalized into a Base Score:
              </p>
              <div className="mt-2 rounded-lg bg-card/60 p-3 font-mono text-xs text-sky-200">
                Base Score = (40 × Quality + 10 × Versatility + 10 × Sentiment + 10 × Commercial) / 70
              </div>
              <p className="mt-2 text-slate-300">
                Awards Prestige integrates through continuous asymmetric scaling to prevent franchise blockbuster inflation:
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li><strong>When Awards Prestige ≥ Base Score:</strong> <code className="text-sky-300 font-mono">Overall = 0.70 × Base + 0.30 × Awards</code> (major accolades elevate the score up to 100).</li>
                <li><strong>When Awards Prestige &lt; Base Score:</strong> the brake activates only after a gap greater than 18 points. Its strength scales smoothly toward 15%, preventing franchise blockbusters without high-tier prestige honors from inflating into Diamond tier.</li>
                <li><strong>Missing Pillars &amp; Historical Imputation:</strong> If commercial data is unavailable (especially pre-1980 careers like Cary Grant or Charlie Chaplin), Commercial Impact is conservatively imputed at 65. If 1 or 2 structural pillars are missing, the final score is capped at 89.</li>
              </ul>
            </div>

            {/* 2. Filmography Quality */}
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Film size={18} className="text-sky-400" /> Filmography Quality (40%)
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li><strong>Eligibility:</strong> Released movies and series with at least {config.VOTING_THRESHOLD} votes. Documentaries (genre 99), TV movies, self appearances, archive footage, and voice roles are strictly excluded.</li>
                <li><strong>Franchise Cap:</strong> Maximum <strong>2 films per franchise/saga</strong> (<code className="text-sky-300 font-mono">belongs_to_collection</code>) are considered (selecting the two highest-rated entries), preventing franchise repetitions from dominating career evaluation.</li>
                <li><strong>Continuous Sliding Window:</strong>
                  <ul className="list-circle pl-5 mt-1 space-y-0.5">
                    <li>If career has ≤ 6 valid works: all eligible works are evaluated.</li>
                    <li>If career has ≥ 14 valid works: selects the top 8 ranked works.</li>
                    <li>Between 6 and 14 works: linearly interpolates between 6 and 8 works.</li>
                  </ul>
                </li>
                <li><strong>Short Careers (3–10 works):</strong> Evaluates top 5 works with customized role weights (Lead 0: 1.35, Order 1: 1.05, Order 2: 0.65, Orders 3–5: 0.15, minor: 0.05) and softer volume calibration (midpoint 6.40, ceiling 7.45) to fairly reflect breakout performers without artificial inflation.</li>
                <li><strong>Bayesian Rating per work:</strong> <code className="text-sky-300 font-mono">Bayes = (v / (v + 200)) × vote_average + (200 / (v + 200)) × 6.5</code>.</li>
                <li><strong>Statistical Multipliers:</strong>
                  <ul className="list-circle pl-5 mt-1 space-y-0.5">
                    <li>Prestige Director Multiplier: <strong>1.25×</strong> if directed by any auteur in the curated prestige director index (unless the actor is also the director).</li>
                    <li>Awarded Film Multiplier: <strong>1.15×</strong> if the title won recognized awards in Wikidata.</li>
                    <li>Billing Order Weights: Order 0 = 1.00, Order 1 = 0.80, Order 2 = 0.60, Orders 3–5 = 0.35, Orders &gt; 5 = 0.10.</li>
                  </ul>
                </li>
                <li><strong>Normalization Scale (6.0 to 7.8):</strong>
                  <div className="my-1.5 rounded-lg bg-card/60 p-2 font-mono text-xs text-sky-200">
                    If q ≤ 6.5: Normalized = 25 + ((q - 6.0) / 0.5) × 30<br />
                    If q &gt; 6.5: Normalized = 55 + ((q - 6.5) / 1.3) × 45
                  </div>
                </li>
              </ul>
            </div>

            {/* 3. Awards Prestige */}
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Award size={18} className="text-sky-400" /> Awards Prestige (30%)
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li><strong>Filter:</strong> Only acting/performance honors count. Directing, writing, producing, music, or technical awards are excluded. Deduplicated by unique award, work, and year.</li>
                <li><strong>Academy Awards (Oscars):</strong>
                  <ul className="list-circle pl-5 mt-1 space-y-0.5">
                    <li>Lead: <strong>38 won / 10 nominated</strong></li>
                    <li>Supporting: <strong>18 won / 6 nominated</strong></li>
                    <li>A won acting Oscar establishes a minimum score floor of <strong>75</strong>.</li>
                    <li>An actor without a Lead Oscar or multiple Oscars is capped at a maximum of <strong>92</strong> in Awards Prestige.</li>
                  </ul>
                </li>
                <li><strong>Tier S (BAFTA, Cannes, Venice, Berlin acting):</strong> Lead 24 won / 8 nom; Supporting 11 won / 4.5 nom. A won Lead Oscar + Lead BAFTA double scores ~88–92 points.</li>
                <li><strong>Tier A (Golden Globes, SAG, Critics Choice, César, Goya):</strong> Lead 10 won / 4 nom; Supporting 5 won / 2 nom. Television acting categories receive a <strong>0.60× damping</strong>.</li>
                <li><strong>Tier B &amp; Genre Awards (Saturn, Sitges, Satellite, Gotham, Spirit, Critics Associations):</strong> Lead 3 won / 1 nom; Supporting 2 won / 0.7 nom. Wins subject to decay (<code className="text-sky-300 font-mono">0.60^k</code>) and capped at a maximum total contribution of <strong>15 points</strong>.</li>
                <li><strong>Micro-Score for Other Awards:</strong> Recognized regional/minor acting honors receive <strong>+0.5 points each</strong>, capped strictly at <strong>10 points</strong>. Popularity awards (MTV Movie Awards, Teen Choice, People's Choice) receive 0 points.</li>
                <li><strong>Logarithmic Scoring Curve:</strong> <code className="text-sky-300 font-mono">Score = min(100, ln(1 + Points) × 100 / ln(101))</code>.</li>
              </ul>
            </div>

            {/* 4. Commercial Impact */}
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <DollarSign size={18} className="text-sky-400" /> Commercial Impact (10%)
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Evaluates the actor's <strong>Top 5 commercial projects</strong> released in 1980 or later with verified positive worldwide gross.</li>
                <li><strong>Franchise Cap:</strong> Maximum <strong>1 movie per franchise/collection</strong> (highest-grossing).</li>
                <li><strong>Logarithmic Worldwide Gross Curve:</strong>
                  <ul className="list-circle pl-5 mt-1 space-y-0.5">
                    <li>Below $10M: 0 points</li>
                    <li>$10M to $500M: Scaled from 0 to 78 points</li>
                    <li>$500M to $1B: Scaled from 78 to 90 points</li>
                    <li>$1B to $2B: Scaled from 90 to 100 points</li>
                    <li>Over $2B: 100 points</li>
                  </ul>
                </li>
                <li><strong>ROI Component:</strong> If budget &gt; 0, <code className="text-sky-300 font-mono">Score = 0.80 × Gross + 0.20 × clamp((log10(Revenue / Budget) / 1) × 100)</code>.</li>
              </ul>
            </div>

            {/* 5. Critical Sentiment */}
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <MessageSquare size={18} className="text-sky-400" /> Critical Sentiment (10%)
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Analyzes TMDb user reviews across the actor's <strong>Top 6 most-voted projects</strong>.</li>
                <li>Reviews are split into individual sentences and filtered: only sentences directly mentioning the actor or their character are evaluated.</li>
                <li><strong>Neutralized Descriptors:</strong> Neutral cinematic genres, plot archetypes, and technical filmmaking descriptors (such as <i>dark, horror, slow, violence, cold</i>) are normalized to prevent algorithmic polarity false positives.</li>
                <li><strong>Compound Polarity Scoring:</strong> VADER compound score mapped into a 0–100 scale:
                  <div className="my-1.5 rounded-lg bg-card/60 p-2 font-mono text-xs text-sky-200">
                    Score = clamp(50 + (CompoundPolarity / 0.80) × 50)
                  </div>
                </li>
              </ul>
            </div>

            {/* 6. Genre Versatility */}
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Compass size={18} className="text-sky-400" /> Genre Versatility (10%)
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Counts distinct grouped genres in credited movies with billing order ≤ 3 and rating ≥ 6.5.</li>
                <li><strong>6 Curated Genre Families:</strong>
                  <ol className="list-decimal pl-5 mt-1 space-y-0.5">
                    <li>Action &amp; Adventure</li>
                    <li>Crime, Thriller &amp; Mystery</li>
                    <li>Science Fiction &amp; Fantasy</li>
                    <li>Romance &amp; Drama</li>
                    <li>Animation</li>
                    <li>Family</li>
                  </ol>
                </li>
                <li>Scoring: <code className="text-sky-300 font-mono">clamp((GroupsCount / 6) × 100)</code>. Covering 6 distinct families yields 100.</li>
              </ul>
            </div>

            <p className="mt-6 border-t border-line pt-4 text-xs text-slate-500 flex items-center justify-between">
              <span>ANI Index — Actors v{config.SCORING_VERSION}</span>
              <a href="/docs" target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">Full Technical Docs →</a>
            </p>
          </div>
        )}

        {/* Global Badge Legend */}
        <div className="mt-8 border-t border-line pt-6">
          <h3 className="text-base sm:text-lg font-bold text-white">Tier Badges &amp; Score Ranges</h3>
          <div className="mt-3 flex flex-wrap gap-4 sm:gap-6">
            {LEGEND.map(([score, label]) => (
              <div key={label} className="flex flex-col items-center gap-1.5">
                <ScoreBadge score={score} size={48} />
                <span className="text-xs text-slate-400 font-medium">{label}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            <strong>Diamond (90–100):</strong> Generational benchmark requiring excellence across all active pillars. <strong>Gold (80–89):</strong> World-class elite careers. <strong>Silver (60–79):</strong> Solid professional careers and box office anchors. <strong>Bronze (40–59):</strong> Mixed filmographies or early career phases.
          </p>
        </div>

        {/* Sources & Disclaimers */}
        <div className="mt-6 border-t border-line pt-4 text-xs text-slate-500 space-y-1">
          <p>Filmographic, financial, and cast/crew metadata provided by <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">The Movie Database (TMDb)</a>. This product uses the TMDb API but is not endorsed or certified by TMDb.</p>
          <p>Ratings and vote counts courtesy of <a href="https://www.imdb.com" target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">IMDb</a> non-commercial datasets. Not affiliated with or endorsed by IMDb.com, Inc.</p>
          <p>Awards, nominations, and career honors aggregated from <a href="https://www.wikidata.org" target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">Wikidata</a> under Creative Commons CC0.</p>
        </div>
      </div>
    </div>
  );
}

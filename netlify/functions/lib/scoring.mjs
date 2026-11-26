import { SentimentIntensityAnalyzer } from "vader-sentiment";
import { SCORING_CONFIG as Cfg } from "./scoring-config.mjs";
import { computeDualRating } from "./imdb.mjs";
import fs from "node:fs";
import path from "node:path";

const curatedNotesPath = path.resolve(process.cwd(), "curated_notes.json");

function loadCuratedNotes() {
  try {
    return JSON.parse(fs.readFileSync(curatedNotesPath, "utf8"));
  } catch {
    return {};
  }
}

export function clamp(value) {
  return Math.max(0, Math.min(100, value));
}

const NON_FICTION_CHARACTER_RE = /^(self|himself|herself|themselves|narrator|host|guest|contestant)\b/i;
const WRESTLING_MMA_TITLE_RE = /\b(WWE|WWF|WCW|ECW|AEW|TNA|NXT|WrestleMania|Royal Rumble|SummerSlam|Survivor Series|Monday Night Raw|SmackDown|UFC|Bellator|Pride FC)\b/i;

function isExcludedRoleOrEvent(character, title, originalTitle = "") {
  if (!character) return true;
  if (NON_FICTION_CHARACTER_RE.test(character)) return true;
  if (/archive footage/i.test(character)) return true;
  if (/\(voice\)/i.test(character)) return true;
  if (/\b(trilogy|collection|anthology|saga|complete)\b/i.test(title)) return true;
  if (WRESTLING_MMA_TITLE_RE.test(title) || (originalTitle && WRESTLING_MMA_TITLE_RE.test(originalTitle))) return true;
  return false;
}

export function validCredits(credits) {
  const today = new Date().toISOString().slice(0, 10);
  return credits
    .filter((credit) => {
      const character = (credit.character || "").trim();
      const releaseDate = (credit.release_date || "").trim();
      const genres = credit.genre_ids || [];
      const title = (credit.title || "").trim();
      const originalTitle = (credit.original_title || "").trim();
      return !isExcludedRoleOrEvent(character, title, originalTitle) &&
        !genres.includes(10770) &&
        !genres.some((genre) => Cfg.EXCLUDED_GENRES.includes(genre)) &&
        (credit.vote_count || 0) >= Cfg.VOTING_THRESHOLD &&
        releaseDate.length >= 10 &&
        releaseDate <= today;
    })
    .map((credit) => ({ ...credit, order: credit.order ?? 99 }));
}

export function validWorks(movieCredits, tvCredits) {
  const movies = validCredits(movieCredits).map((credit) => ({
    ...credit,
    title: credit.title || "",
    media_type: "movie"
  }));
  const today = new Date().toISOString().slice(0, 10);
  const excludedTv = Cfg.EXCLUDED_TV_GENRES || [99, 10763, 10764, 10767, 10770];
  // For TV series, do not filter by fixed episode_count or high TMDb vote threshold here;
  // episode participation % (vs regular seasons) and vote threshold (TMDb >= 50 || IMDb >= 1000)
  // are evaluated after resolving tvDetails & IMDb IDs in actor.mjs.
  const series = (tvCredits || [])
    .filter((credit) => {
      const character = (credit.character || "").trim();
      const releaseDate = (credit.first_air_date || "").trim();
      const genres = credit.genre_ids || [];
      const title = (credit.name || "").trim();
      const originalTitle = (credit.original_name || "").trim();
      return (credit.episode_count || 0) >= 1 &&
        !isExcludedRoleOrEvent(character, title, originalTitle) &&
        !genres.some((genre) => excludedTv.includes(genre)) &&
        releaseDate.length >= 10 &&
        releaseDate <= today;
    })
    .map((credit) => ({
      ...credit,
      title: credit.name || "",
      release_date: credit.first_air_date || "",
      order: credit.order ?? 99,
      media_type: "tv"
    }));
  const works = new Map();
  for (const work of [...movies, ...series]) {
    const key = `${work.media_type}:${work.id}`;
    if (!works.has(key)) works.set(key, work);
  }
  return [...works.values()];
}

export function tvParticipationWeight(episodeCount, totalRegularEpisodes) {
  if (!totalRegularEpisodes || totalRegularEpisodes <= 0) return { pct: 0, weight: 0 };
  const pct = Math.min(100, (episodeCount / totalRegularEpisodes) * 100);
  if (pct < 35) return { pct, weight: 0 };
  if (pct < 50) return { pct, weight: 0.35 };
  if (pct < 75) return { pct, weight: 0.50 };
  if (pct < 90) return { pct, weight: 0.75 };
  return { pct, weight: 1.00 };
}

export function weight(order) {
  if (order === 0) return Cfg.CREDIT_WEIGHTS.order0;
  if (order === 1) return Cfg.CREDIT_WEIGHTS.order1;
  if (order === 2) return Cfg.CREDIT_WEIGHTS.order2;
  if (order >= 3 && order <= 5) return Cfg.CREDIT_WEIGHTS.order3to5;
  return Cfg.CREDIT_WEIGHTS.minor;
}

export function rating(credit) {
  const imdbWeight = credit.media_type === "tv" ? 0.75 : 0.60;
  return computeDualRating(
    credit.vote_average,
    credit.imdb_rating,
    imdbWeight
  );
}

function normalizeFranchiseText(value) {
  return String(value || "").toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getFranchiseKey(title, originalTitle = "") {
  const candidates = [originalTitle, title].map(normalizeFranchiseText).filter(Boolean);
  const franchiseAliases = [
    ["avengers", /\b(?:the )?avengers\b/],
    ["spider-man", /\bspider[\s-]*man\b|\bspiderman\b/],
    ["john-wick", /\bjohn wick\b/],
    ["dune", /\bdune\b/],
    ["hunger-games", /\bhunger games\b/],
    ["padre-no-hay-mas-que-uno", /\bpadre no hay mas que uno\b/],
    ["star-wars", /\bstar wars\b/],
    ["pirates-of-the-caribbean", /\b(?:pirates of the caribbean|piratas del caribe)\b/]
  ];
  for (const [key, pattern] of franchiseAliases) {
    if (candidates.some((candidate) => pattern.test(candidate))) return `known:${key}`;
  }

  const roots = candidates.map((candidate) => candidate
    .split(/:|–|—|\s-\s/, 1)[0]
    .replace(/\b(?:part|chapter|vol(?:ume)?|episode)\.?\s*(?:\d+|[ivxlcdm]+)\b.*$/i, "")
    .replace(/\s+(?:\d+|[ivxlcdm]+)$/i, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim())
    .filter(Boolean)
    .sort((a, b) => a.length - b.length);
  return roots[0] || candidates[0] || "";
}

export function quality(valid, qualityOptions = {}) {
  const allWorks = qualityOptions.allWorks?.length ? qualityOptions.allWorks : valid;
  if (!allWorks.length) return 0;
  const directorMovieIds = new Set(qualityOptions.directorMovieIds || []);
  const awardMovieNames = qualityOptions.awardMovieNames || [];
  const workCount = allWorks.length;
  const isShortCareer = workCount >= 3 && workCount <= 10;
  const collectionByMovieId = qualityOptions.collectionByMovieId;

  const movieWorks = allWorks.filter((work) => (work.media_type || "movie") === "movie");

  // Ignore TV series below the actor's cinema mean so TV never drags consistency down.
  const cinemaWorks = allWorks.filter((w) => (w.media_type || "movie") === "movie");
  const cinemaMeanRating = cinemaWorks.length
    ? cinemaWorks.reduce((sum, w) => sum + rating(w), 0) / cinemaWorks.length
    : 0;

  const eligibleWorks = [];
  for (const credit of allWorks) {
    const b = rating(credit);
    if (credit.media_type === "tv" && cinemaWorks.length > 0 && b < cinemaMeanRating) {
      continue;
    }
    const colEntry = credit.collectionId || collectionByMovieId?.get(credit.id) || credit.belongs_to_collection || null;
    const colId = typeof colEntry === "object" ? colEntry?.id : colEntry;
    const fallbackRoot = credit.media_type === "movie"
      ? getFranchiseKey(credit.title, credit.original_title)
      : "";
    const franchiseId = colId
      ? `collection:${colId}`
      : fallbackRoot ? `title:${fallbackRoot}` : null;
    eligibleWorks.push({ credit, rating: b, franchiseId });
  }

  const franchiseGroups = new Map();
  for (const work of eligibleWorks) {
    if (!work.franchiseId) continue;
    if (!franchiseGroups.has(work.franchiseId)) franchiseGroups.set(work.franchiseId, []);
    franchiseGroups.get(work.franchiseId).push(work);
  }
  for (const group of franchiseGroups.values()) {
    group.sort((a, b) => b.rating - a.rating);
    group.forEach((work, index) => {
      work.franchiseWeight = index === 0 ? 1
        : index === 1 ? 0.60
          : index === 2 ? 0.40
            : index === 3 ? 0.25
              : 0.15;
    });
  }

  // 2. Selected works count
  let selectedCount;
  if (isShortCareer) {
    selectedCount = Math.min(5, eligibleWorks.length);
  } else if (workCount <= Cfg.FILMOGRAPHY_WORKS.few) {
    selectedCount = eligibleWorks.length;
  } else if (workCount >= Cfg.FILMOGRAPHY_WORKS.many) {
    selectedCount = Cfg.QUALITY.manyMaxWorks;
  } else {
    selectedCount = Math.round(
      Cfg.FILMOGRAPHY_WORKS.few +
      ((workCount - Cfg.FILMOGRAPHY_WORKS.few) *
        (Cfg.QUALITY.manyMaxWorks - Cfg.FILMOGRAPHY_WORKS.few) /
        (Cfg.FILMOGRAPHY_WORKS.many - Cfg.FILMOGRAPHY_WORKS.few))
    );
  }

  // 3. Weighting
  const ranked = eligibleWorks.map(({ credit, rating: workRating, franchiseId, franchiseWeight }) => {
    let finalWeight;
    if (credit.media_type === "tv" && typeof credit.tvWeight === "number") {
      finalWeight = credit.tvWeight;
    } else {
      finalWeight = weight(credit.order);
      if (isShortCareer) {
        if (credit.order === 0) finalWeight = 1.35;
        else if (credit.order === 1) finalWeight = 1.05;
        else if (credit.order === 2) finalWeight = 0.65;
        else if (credit.order <= 5) finalWeight = 0.15;
        else finalWeight = 0.05;
      }
    }
    if (directorMovieIds.has(credit.id)) finalWeight *= Cfg.DIRECTOR_MULTIPLIER;
    if (awardMovieNames.some((name) => name && credit.title &&
      name.toLowerCase().trim() === credit.title.toLowerCase().trim())) {
      finalWeight *= Cfg.AWARD_MOVIE_MULTIPLIER;
    }
    return { rating: workRating, roleWeight: finalWeight, franchiseWeight: franchiseWeight || 1, franchiseId };
  }).sort((a, b) =>
    (b.rating * b.roleWeight * b.franchiseWeight) -
    (a.rating * a.roleWeight * a.franchiseWeight)
  );
  const rankedSelected = ranked.slice(0, selectedCount);

  const n = rankedSelected.reduce((sum, item) => sum + item.roleWeight * item.franchiseWeight, 0);
  const q = n
    ? rankedSelected.reduce((sum, item) => sum + item.roleWeight * item.franchiseWeight * item.rating, 0) / n
    : 0;

  // 4. Soften volume penalty for short careers (3–10 works)
  const minimum = Cfg.QUALITY.minimum;
  const maximum = isShortCareer ? 7.45 : Cfg.QUALITY.maximum;
  const midpoint = isShortCareer ? 6.40 : 6.5;
  let normalized;
  if (q <= midpoint) {
    normalized = 25 + ((q - minimum) / (midpoint - minimum)) * 30;
  } else {
    normalized = 55 + ((q - midpoint) / (maximum - midpoint)) * 45;
  }
  return clamp(normalized);
}

export function tier(label) {
  const lower = label.toLowerCase();
  for (const [awardTier, keywords] of Object.entries(Cfg.AWARD_TIER_KEYWORDS)) {
    if (keywords.some((keyword) => lower.includes(keyword))) return awardTier;
  }
  return null;
}

function interpretationFilter(label) {
  const lower = label.toLowerCase();
  const performanceTerms = [
    ...Cfg.AWARD_KEYWORDS.performance,
    "best actor",
    "best actress",
    "best male lead",
    "best female lead",
    "best lead performance",
    "best supporting male",
    "best supporting female",
    "lead performance",
    "supporting performance",
    "male lead",
    "female lead",
    "main actor",
    "leading role",
    "mejor actor",
    "mejor actriz",
    "interpretación",
    "interpretacion",
    "coppa volpi",
    "volpi cup",
    "goya"
  ];
  const performanceMatch = performanceTerms.some((word) => lower.includes(word));
  if (!performanceMatch) return false;
  const explicitlyExcluded = Cfg.AWARD_KEYWORDS.excluded.some((word) => lower.includes(word));
  if (explicitlyExcluded) {
    const leadMatch = lower.includes("actor") || lower.includes("actress");
    if (!leadMatch) return false;
  }
  return true;
}

export function awardsScore(awards) {
  const ignored = [];
  const counted = [];
  const deduplicated = new Map();
  let wonOscar = false;
  for (const award of awards) {
    const label = award.label || "";
    const awardTier = tier(label);
    if (awardTier === "0") {
      ignored.push({ label, awardQid: award.awardQid || "", kind: award.kind || "", reason: "Popularity award" });
      continue;
    }
    if (!interpretationFilter(label) || awardTier === null) {
      ignored.push({ label, awardQid: award.awardQid || "", kind: award.kind || "", reason: awardTier === null ? "Not an acting award" : "Category not recognized" });
      continue;
    }
    const year = award.year || "";
    const work = award.work || "";
    const normalizedLabel = label.toLowerCase().trim();
    const normalizedWork = work.toLowerCase().trim();
    let existingKey = null;
    for (const [key, existing] of deduplicated) {
      if (award.awardQid && existing.awardQid && award.awardQid === existing.awardQid) {
        if (year && existing.year && year !== existing.year) continue;
        existingKey = key;
        break;
      } else if (normalizedLabel === (existing.label || "").toLowerCase().trim()) {
        if (normalizedWork || (existing.work || "").trim()) {
          if (normalizedWork !== (existing.work || "").toLowerCase().trim()) continue;
        }
        if (year && existing.year && year !== existing.year) continue;
        existingKey = key;
        break;
      }
    }
    const existing = existingKey ? deduplicated.get(existingKey) : null;
    const kind = award.kind === "won" || existing?.kind === "won" ? "won" : "nominated";
    const preferredYear = existing?.year && !year ? existing.year : year || existing?.year || "";
    const preferredWork = existing?.workQid && !award.workQid ? existing.work : work || existing?.work || "";
    const preferredAwardQid = award.awardQid || existing?.awardQid || "";
    const preferredWorkQid = award.workQid || existing?.workQid || "";
    if (!existingKey) {
      existingKey = award.awardQid
        ? `qid:${award.awardQid}|work:${award.workQid || normalizedWork || ""}|${year || "no-year"}`
        : `label:${normalizedLabel}|work:${normalizedWork}|${year || "no-year"}`;
    }
    deduplicated.set(existingKey, {
      ...award,
      ...existing,
      label,
      kind,
      year: preferredYear,
      work: preferredWork,
      awardQid: preferredAwardQid,
      workQid: preferredWorkQid,
      tier: awardTier
    });
  }
  const tierBRepeats = new Map();
  let accumulatedTierBPoints = 0;
  const maxTierB = Cfg.TIER_B_CAP || 15;
  let wonLeadOscar = false;
  let wonOscarsCount = 0;

  for (const award of deduplicated.values()) {
    const lower = award.label.toLowerCase();
    const supporting = lower.includes("supporting");
    const role = supporting ? "supporting" : "lead";
    const isOscar = (lower.includes("academy award") || lower.includes("oscar") || lower.includes("premio oscar")) &&
      (lower.includes("actor") || lower.includes("actress") ||
       lower.includes("performance") || lower.includes("interpretation"));
    let points = isOscar
      ? Cfg.OSCAR_POINTS[role][award.kind]
      : Cfg.AWARD_TIERS[award.tier][role][award.kind];

    const isTv = lower.includes("television") || lower.includes("series") || lower.includes("miniseries") || lower.includes("emmy");
    if (isTv && !isOscar) {
      points *= 0.60;
    }

    if (award.tier === "B") {
      const bKey = lower.includes("saturn") ? "saturn" :
                   lower.includes("sitges") ? "sitges" :
                   lower.includes("satellite") ? "satellite" :
                   lower.includes("gotham") ? "gotham" :
                   lower.includes("critics") ? "critics" : award.label;
      const count = tierBRepeats.get(bKey) || 0;
      tierBRepeats.set(bKey, count + 1);
      const decay = Math.pow(0.60, count);
      const decayedPoints = points * decay;
      const remainingTierB = Math.max(0, maxTierB - accumulatedTierBPoints);
      const allowedPoints = Math.min(decayedPoints, remainingTierB);
      accumulatedTierBPoints += allowedPoints;
      points = allowedPoints;
    }

    if (isOscar && award.kind === "won") {
      wonOscar = true;
      wonOscarsCount++;
      if (role === "lead") wonLeadOscar = true;
    }
    counted.push({ ...award, role, points });
  }
  const otherAwards = ignored.filter((award) => award.reason !== "Popularity award");
  const otherAwardPoints = Math.min(
    Cfg.OTHER_AWARD_CAP || 10,
    otherAwards.length * (Cfg.OTHER_AWARD_POINTS || 0.5)
  );

  const total = counted.reduce((sum, award) => sum + award.points, 0) + otherAwardPoints;
  let score = clamp(Math.min(100, Math.log(1 + total) * 100 / Cfg.AWARD_CURVE_DENOMINATOR));
  if (wonOscar) score = Math.max(score, Cfg.AWARDS_OSCAR_FLOOR);
  if (!wonLeadOscar && wonOscarsCount < 2) {
    score = Math.min(score, 92);
  }
  const summary = new Map();
  for (const award of counted) {
    let canonicalLabel = award.label;
    const lower = canonicalLabel.toLowerCase();
    if (lower.includes("golden globe") && lower.includes("best actress")) {
      canonicalLabel = "Golden Globe Award for Best Actress";
    }
    const key = `${canonicalLabel}|${award.role}`;
    const current = summary.get(key) || {
      label: canonicalLabel, tier: award.tier, role: award.role, won: 0, nominated: 0
    };
    current[award.kind]++;
    summary.set(key, current);
  }
  return [score, [...summary.values()], counted.length, ignored];
}

export function versatility(valid) {
  const groups = new Set();
  for (const credit of valid) {
    if (credit.order <= 3 && credit.vote_average >= 6.5) {
      for (const group of Cfg.GENRE_GROUPS) {
        if ((credit.genre_ids || []).some((genre) => group.ids.includes(genre))) groups.add(group.name);
      }
    }
  }
  return clamp((groups.size / Cfg.VERSATILITY_MAX_GROUPS) * 100);
}

export function reviewMovies(valid, limit = Cfg.REVIEW_MOVIES_LIMIT) {
  return [...valid]
    .sort((a, b) => (weight(b.order) * b.vote_count) - (weight(a.order) * a.vote_count))
    .slice(0, limit);
}

function terms(name, characters) {
  const termsSet = new Set([name.split(/\s+/).pop().toLowerCase(), name.toLowerCase()]);
  for (const character of characters) {
    for (const part of character.split(/[/(),]| and /i)) {
      const cleaned = part.replace(/\b(uncredited|voice|young|old)\b/gi, "").trim().toLowerCase();
      if (cleaned.length >= 4) termsSet.add(cleaned);
    }
  }
  return [...termsSet].map((term) =>
    new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"));
}

export function sentiment(name, movies, reviewsByMovie, sentimentOptions = {}) {
  const hits = [];
  movies.forEach((movie, index) => {
    const patterns = terms(name, [movie.character || ""]);
    let hitWeight = weight(movie.order);
    if ((sentimentOptions.directorMovieIds || []).includes(movie.id)) {
      hitWeight *= Cfg.DIRECTOR_MULTIPLIER;
    }
    if ((sentimentOptions.awardMovieNames || []).some((title) =>
      title && movie.title &&
      title.toLowerCase().trim() === movie.title.toLowerCase().trim()
    )) {
      hitWeight *= Cfg.AWARD_MOVIE_MULTIPLIER;
    }
    for (const review of reviewsByMovie[index] || []) {
      const text = (review.content || "").replace(/\r/g, " ").replace(/\n/g, " ");
      for (const sentence of text.split(/(?<=[.!?])\s+/)) {
        if (patterns.some((pattern) => pattern.test(sentence))) {
          const neutralized = sentence.replace(
            /\b(dark|brutal|haunting|disturbing|twisted|madness|unsettling|violent|grim|obsessive|chaotic|bleak|tragic|intense)\b/gi,
            "cinematic"
          );
          hits.push([
            SentimentIntensityAnalyzer.polarity_scores(neutralized).compound,
            sentence.trim(),
            movie.title,
            hitWeight
          ]);
        }
      }
    }
  });
  if (hits.length < Cfg.MIN_REVIEW_MENTIONS) return [null, []];
  const hitWeightTotal = hits.reduce((sum, hit) => sum + hit[3], 0);
  const avg = hitWeightTotal
    ? hits.reduce((sum, hit) => sum + hit[0] * hit[3], 0) / hitWeightTotal
    : 0;
  const good = [...hits].sort((a, b) => b[0] - a[0])
    .filter((hit) => hit[1].length >= 40 && hit[1].length <= 320).slice(0, 3);
  const score = clamp(avg >= 0 ? 52 + (avg * 48) : 52 + (avg * 52));
  return [score, good.map((hit) => ({ text: hit[1], movie: hit[2] }))];
}

export function commercialImpact(commercialMovies = []) {
  const counted = [];
  const excluded = { saga: 0, revenue: 0, date: 0 };
  for (const movie of commercialMovies) {
    if (!movie.revenue) {
      excluded.revenue++;
      continue;
    }
    const year = Number.parseInt(movie.release_date?.slice(0, 4), 10);
    if (!Number.isInteger(year) || year < 1980) {
      excluded.date++;
      continue;
    }
    const revenue = Number(movie.revenue);
    if (!Number.isFinite(revenue) || revenue <= 0) {
      excluded.revenue++;
      continue;
    }
    const revenueLog = Math.log10(revenue);
    let grossScore;
    if (revenueLog <= 7) {
      grossScore = 0;
    } else if (revenueLog <= Math.log10(500_000_000)) {
      grossScore = ((revenueLog - 7) / (Math.log10(500_000_000) - 7)) * 78;
    } else if (revenueLog <= 9) {
      grossScore = 78 + ((revenueLog - Math.log10(500_000_000)) / (9 - Math.log10(500_000_000))) * 12;
    } else if (revenueLog <= Math.log10(2_000_000_000)) {
      grossScore = 90 + ((revenueLog - 9) / (Math.log10(2_000_000_000) - 9)) * 10;
    } else {
      grossScore = 100;
    }
    grossScore = clamp(grossScore);
    const budget = Number(movie.budget);
    let movieScore = grossScore;
    if (Number.isFinite(budget) && budget > 0) {
      const rawRoi = revenue / budget;
      const roi = Math.max(Cfg.COMMERCIAL_ROI_FLOOR, Math.min(Cfg.COMMERCIAL_ROI_CAP, rawRoi));
      const roiScore = clamp(((Math.log10(roi) - Math.log10(Cfg.COMMERCIAL_ROI_FLOOR)) /
        (Math.log10(Cfg.COMMERCIAL_ROI_CAP) - Math.log10(Cfg.COMMERCIAL_ROI_FLOOR))) * 100);
      const year = Number(String(movie.release_date || "").slice(0, 4));
      const decadeFactor = year < 1980 ? 1.08 : year < 1990 ? 1.06 : year < 2000 ? 1.03 :
        year < 2010 ? 1.00 : year < 2020 ? 0.97 : 0.95;
      const decadeAdjustedGross = clamp(grossScore * decadeFactor);
      movieScore = clamp(
        (Cfg.COMMERCIAL_GROSS_WEIGHT * decadeAdjustedGross) +
        (Cfg.COMMERCIAL_ROI_WEIGHT * roiScore)
      );
    }
    counted.push({ ...movie, score: movieScore });
  }
  if (counted.length < Cfg.COMMERCIAL_MIN_VALID_MOVIES) {
    return [null, counted.length, excluded];
  }
  const topCommercial = [...counted]
    .sort((a, b) =>
      (b.score * (b.weight || 0)) - (a.score * (a.weight || 0))
    )
    .slice(0, 5);
  const n = topCommercial.reduce((sum, movie) => sum + (movie.weight || 0), 0);
  const weightedAverage = n
    ? topCommercial.reduce((sum, movie) => sum + (movie.weight || 0) * movie.score, 0) / n
    : 0;
  const finalScore = clamp(weightedAverage);
  return [finalScore, counted.length, excluded];
}

export function compute(person, credits, awardsInput = [], reviewsByMovie = [], revMovies = [], qualityOptions = {}) {
  const awardsAvailable = Array.isArray(awardsInput)
    ? true
    : awardsInput.available !== false;
  const awards = Array.isArray(awardsInput) ? awardsInput : (awardsInput.awards || []);
  const awardsStatus = Array.isArray(awardsInput)
    ? "available"
    : (awardsInput.status || (awardsAvailable ? "available" : "unavailable"));
  const rawValid = validCredits(credits);
  const enrichedMovies = Array.isArray(qualityOptions.allWorks)
    ? new Map(qualityOptions.allWorks
      .filter((work) => (work.media_type || "movie") === "movie")
      .map((work) => [work.id, work]))
    : null;
  const valid = enrichedMovies
    ? rawValid
      .filter((credit) => enrichedMovies.has(credit.id))
      .map((credit) => ({ ...credit, ...enrichedMovies.get(credit.id) }))
    : rawValid;
  const [awardsValue, notable, awardCount, ignoredAwards] = awardsScore(awards);
  const awardMovieNames = [...new Set(awards
    .filter((award) => award.kind === "won" && award.work)
    .map((award) => award.work))];
  qualityOptions = {
    ...qualityOptions,
    awardMovieNames: [...(qualityOptions.awardMovieNames || []), ...awardMovieNames]
  };
  const allWorks = qualityOptions.allWorks || valid;
  qualityOptions.allWorks = allWorks;
  const [sentimentValue, excerpts] = sentiment(person.name, revMovies, reviewsByMovie, qualityOptions);
  const [commercialValue, commercialCount, commercialExcluded] =
    commercialImpact(qualityOptions.commercialMovies || []);
  const commercialValueWithFallback = commercialValue === null ? 65 : commercialValue;
  const commercialIncludedTitles = (qualityOptions.commercialMovies || [])
    .filter((movie) =>
      movie.revenue > 0 &&
      movie.release_date &&
      Number(movie.release_date.slice(0, 4)) >= 1980
    )
    .map((movie) => movie.title)
    .filter(Boolean);
  const commercialExcludedTitles = (qualityOptions.commercialMovies || [])
    .filter((movie) =>
      !movie.revenue ||
      !movie.release_date ||
      Number(movie.release_date.slice(0, 4)) < 1980
    )
    .map((movie) => movie.title)
    .filter(Boolean);
  const calculateScoreForWorks = (worksForQuality) => {
    const p = {
      quality: quality(valid, { ...qualityOptions, allWorks: worksForQuality }),
      awards: awardsValue,
      versatility: versatility(worksForQuality),
      sentiment: sentimentValue,
      commercial: commercialValueWithFallback
    };
    const bKeys = ["quality", "versatility", "sentiment", "commercial"];
    const bAvail = bKeys.filter((key) => p[key] !== null);
    const bWeightTotal = bAvail.reduce((sum, key) => sum + Cfg.WEIGHTS[key], 0);
    const bScore = bWeightTotal
      ? bAvail.reduce((sum, key) => sum + p[key] * Cfg.WEIGHTS[key] / bWeightTotal, 0)
      : 0;
    const aAvail = p.awards ?? 0;
    let s = aAvail >= bScore
      ? (0.70 * bScore) + (0.30 * aAvail)
      : (() => {
          const excess = Math.max(0, bScore - aAvail - Cfg.AWARD_BRAKE_THRESHOLD);
          const brakeStrength = Cfg.AWARD_BRAKE_MAX_WEIGHT *
            Math.min(1, excess / Cfg.AWARD_BRAKE_MAX_EXCESS);
          return ((1 - brakeStrength) * bScore) + (brakeStrength * aAvail);
        })();
    const missing = bKeys.length - bAvail.length;
    if (missing >= 1 && missing <= 2) s = Math.min(s, Cfg.SENTIMENT.missingPillarCap);
    s = Math.min(s, Cfg.QUALITY.finalScoreCap);
    return { score: s, pillars: p };
  };

  // Non-penalization rule: compute cinema-only baseline and combined cinema+TV score;
  // TV series can only boost or maintain the actor's cinema score, never lower it.
  const cineResult = valid.length ? calculateScoreForWorks(valid) : null;
  const combinedResult = calculateScoreForWorks(allWorks);
  const pillars = combinedResult.pillars;
  const score = cineResult
    ? Math.max(cineResult.score, combinedResult.score)
    : combinedResult.score;

  const leads = [...allWorks]
    .filter((credit) => credit.media_type === "tv" ? (credit.tvWeight || 0) >= 0.50 : credit.order <= Cfg.TOP_LEAD_MAX_ORDER)
    .sort((a, b) => b.vote_average - a.vote_average);
  const curatedNotes = loadCuratedNotes();
  const curated = curatedNotes[String(person.id)] || curatedNotes[person.name] || null;
  const cleanSummary = (person.biography || "")
    .replace(/\u00c2/g, "")
    .replace(/\u00a0/g, " ")
    .normalize("NFKC")
    .trim()
    .slice(0, 320);
  return {
    id: person.id,
    name: person.name,
    profile: person.profile_path || null,
    summary: cleanSummary,
    score,
    scoring_version: Cfg.SCORING_VERSION,
    pillars: Object.fromEntries(Object.entries(pillars).map(([key, value]) =>
      [key, value === null ? null : value])),
    awards: notable,
    award_count: awardCount,
    ignored_awards: ignoredAwards,
    awards_available: awardsAvailable,
    awards_status: awardsStatus,
    few_works: allWorks.length <= Cfg.FILMOGRAPHY_WORKS.few,
    lead_movie_count: qualityOptions.leadMovieCount ?? valid.filter((credit) => credit.order <= 2).length,
    saga_movie_count: qualityOptions.sagaMovieCount || 0,
    commercial_movie_count: commercialCount,
    commercial_excluded: commercialExcluded,
    commercial_included_titles: commercialIncludedTitles,
    commercial_excluded_titles: commercialExcludedTitles,
    valid_work_count: allWorks.length,
    director_movie_count: qualityOptions.directorMovieCount || 0,
    curated_notes: curated ? (Array.isArray(curated) ? curated : [curated]) : [],
    excerpts,
    leads: leads.slice(0, 6).map((credit) => ({
      id: credit.id,
      title: credit.title,
      media_type: credit.media_type || "movie",
      ...(credit.media_type === "tv" && credit.participationPct != null ? { participation_pct: credit.participationPct } : {}),
      rating: Math.round(credit.vote_average * 10) / 10,
      tmdb_rating: Number(credit.vote_average) || 0,
      tmdb_votes: Number(credit.vote_count) || 0,
      imdb_rating: Number(credit.imdb_rating) || null,
      imdb_votes: Number(credit.imdb_votes) || 0,
      final_rating: Math.round(rating(credit) * 10) / 10,
      year: (credit.release_date || "").slice(0, 4)
    }))
  };
}

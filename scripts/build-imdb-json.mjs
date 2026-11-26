import fs from "node:fs";
import https from "node:https";
import zlib from "node:zlib";
import readline from "node:readline";

const IMDB_RATINGS_URL = "https://datasets.imdbws.com/title.ratings.tsv.gz";
const IMDB_BASICS_URL = "https://datasets.imdbws.com/title.basics.tsv.gz";
const OUTPUT_FILE = process.argv[2] || "imdb-ratings.json";
const MIN_VOTES = 300;

const ALLOWED_TYPES = new Set(["movie", "tvSeries", "tvMiniSeries"]);
const EXCLUDED_GENRES = new Set(["Documentary", "News", "Talk-Show", "Reality-TV", "Game-Show"]);

function streamTsvGz(url, onLine) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: HTTP ${res.statusCode}`));
        return;
      }
      const gunzip = zlib.createGunzip();
      const rl = readline.createInterface({
        input: res.pipe(gunzip),
        crlfDelay: Infinity
      });
      rl.on("line", onLine);
      rl.on("close", resolve);
      gunzip.on("error", reject);
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function buildImdbJson() {
  console.log(`Step 1/2: Streaming IMDb ratings from ${IMDB_RATINGS_URL} (numVotes >= ${MIN_VOTES})...`);
  const candidateRatings = new Map();
  let ratingsLines = 0;

  await streamTsvGz(IMDB_RATINGS_URL, (line) => {
    ratingsLines++;
    if (ratingsLines === 1 && line.startsWith("tconst")) return;
    const tab1 = line.indexOf("\t");
    if (tab1 === -1) return;
    const tab2 = line.indexOf("\t", tab1 + 1);
    if (tab2 === -1) return;

    const votes = parseInt(line.slice(tab2 + 1), 10);
    if (votes >= MIN_VOTES) {
      const tconst = line.slice(0, tab1);
      const avg = parseFloat(line.slice(tab1 + 1, tab2));
      candidateRatings.set(tconst, [avg, votes]);
    }
  });

  console.log(`Processed ${ratingsLines} rating rows. Candidates with >= ${MIN_VOTES} votes: ${candidateRatings.size}`);
  console.log(`Step 2/2: Streaming IMDb basics from ${IMDB_BASICS_URL} to filter types & genres...`);

  const finalRatings = {};
  let basicsLines = 0;
  let keptCount = 0;

  // title.basics.tsv columns:
  // 0: tconst | 1: titleType | 2: primaryTitle | 3: originalTitle | 4: isAdult | 5: startYear | 6: endYear | 7: runtimeMinutes | 8: genres
  await streamTsvGz(IMDB_BASICS_URL, (line) => {
    basicsLines++;
    if (basicsLines === 1 && line.startsWith("tconst")) return;

    const cols = line.split("\t");
    if (cols.length < 9) return;

    const tconst = cols[0];
    const ratingEntry = candidateRatings.get(tconst);
    if (!ratingEntry) return;

    const titleType = cols[1];
    if (!ALLOWED_TYPES.has(titleType)) return; // Excludes tvEpisode, short, tvMovie, videoGame, etc.

    const isAdult = cols[4];
    if (isAdult === "1") return;

    const genresStr = cols[8];
    if (genresStr && genresStr !== "\\N") {
      const genres = genresStr.split(",");
      if (genres.some((g) => EXCLUDED_GENRES.has(g))) return;
    }

    finalRatings[tconst] = ratingEntry;
    keptCount++;
  });

  console.log(`Processed ${basicsLines} basics rows. Kept ${keptCount} valid titles (movie, tvSeries, tvMiniSeries).`);
  console.log(`Writing minified JSON to ${OUTPUT_FILE}...`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalRatings));
  const stats = fs.statSync(OUTPUT_FILE);
  console.log(`Output written successfully: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
}

buildImdbJson().catch((err) => {
  console.error("Error building IMDb ratings JSON:", err);
  process.exit(1);
});

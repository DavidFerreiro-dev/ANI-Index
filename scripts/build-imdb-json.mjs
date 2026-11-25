import fs from "node:fs";
import https from "node:https";
import zlib from "node:zlib";
import readline from "node:readline";

const IMDB_RATINGS_URL = "https://datasets.imdbws.com/title.ratings.tsv.gz";
const OUTPUT_FILE = process.argv[2] || "imdb-ratings.json";
const MIN_VOTES = 300;

console.log(`Downloading and processing IMDb ratings from ${IMDB_RATINGS_URL}...`);
console.log(`Filtering titles with numVotes >= ${MIN_VOTES}...`);

async function buildImdbJson() {
  return new Promise((resolve, reject) => {
    https.get(IMDB_RATINGS_URL, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download IMDb ratings: HTTP ${res.statusCode}`));
        return;
      }

      const gunzip = zlib.createGunzip();
      const rl = readline.createInterface({
        input: res.pipe(gunzip),
        crlfDelay: Infinity
      });

      const ratings = {};
      let lineCount = 0;
      let matchedCount = 0;

      rl.on("line", (line) => {
        lineCount++;
        // Header line: tconst  averageRating   numVotes
        if (lineCount === 1 && line.startsWith("tconst")) return;

        const tab1 = line.indexOf("\t");
        if (tab1 === -1) return;
        const tab2 = line.indexOf("\t", tab1 + 1);
        if (tab2 === -1) return;

        const tconst = line.slice(0, tab1);
        const avgStr = line.slice(tab1 + 1, tab2);
        const votesStr = line.slice(tab2 + 1);

        const votes = parseInt(votesStr, 10);
        if (votes >= MIN_VOTES) {
          const avg = parseFloat(avgStr);
          // format: {"tt0468569": [9.0, 2950000]}
          ratings[tconst] = [avg, votes];
          matchedCount++;
        }
      });

      rl.on("close", () => {
        console.log(`Processed ${lineCount} rows. Found ${matchedCount} titles with >= ${MIN_VOTES} votes.`);
        console.log(`Writing minified JSON to ${OUTPUT_FILE}...`);
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(ratings));
        const stats = fs.statSync(OUTPUT_FILE);
        console.log(`Output written successfully: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
        resolve();
      });

      gunzip.on("error", reject);
      res.on("error", reject);
    }).on("error", reject);
  });
}

buildImdbJson().catch((err) => {
  console.error("Error building IMDb ratings JSON:", err);
  process.exit(1);
});


import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDirectory, "../.env") });

const key = process.env.TMDB_API_KEY;
if (!key) {
  console.error("TMDB_API_KEY is not set. Create a root .env file or set the Netlify environment variable.");
  process.exit(1);
}

const url = new URL("https://api.themoviedb.org/3/search/person");
const headers = {};
if (key.split(".").length === 3) headers.Authorization = `Bearer ${key}`;
else url.searchParams.set("api_key", key);
url.searchParams.set("query", "Mikey Madison");
url.searchParams.set("include_adult", "false");

try {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    console.error(`TMDb test failed with status ${response.status}.`);
    process.exit(1);
  }
  const data = await response.json();
  const found = (data.results || []).find((person) =>
    person.name === "Mikey Madison" && person.known_for_department === "Acting");
  if (!found) {
    console.error("TMDb is reachable, but Mikey Madison was not found.");
    process.exit(1);
  }
  console.log(`TMDb API is working. Test actor: ${found.name} (ID ${found.id}).`);
} catch (error) {
  console.error(`TMDb test failed: ${error.message}`);
  process.exit(1);
}

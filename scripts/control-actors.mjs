import fs from "node:fs/promises";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildActor } from "../netlify/functions/lib/actor.mjs";
import { searchPerson } from "../netlify/functions/lib/tmdb.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDirectory, "../.env") });

if (!process.env.TMDB_API_KEY) {
  console.error("TMDB_API_KEY is required.");
  process.exit(1);
}

const controls = JSON.parse(await fs.readFile(path.resolve(scriptDirectory, "../control-actors.json"), "utf8"));
console.log("Control actors — ranges are estimates, not failures.");
for (const control of controls) {
  try {
    const search = await searchPerson(control.name);
    const person = search.find((item) =>
      item.name.toLowerCase() === control.name.toLowerCase() &&
      item.known_for_department === "Acting"
    ) || search.find((item) => item.known_for_department === "Acting");
    if (!person) {
      console.log(`${control.name} | not found`);
      continue;
    }
    const actor = await buildActor(person.id);
    const inRange = actor.score >= control.range[0] && actor.score <= control.range[1];
    console.log(`${control.name} | ${actor.score} | expected ${control.range[0]}–${control.range[1]} | ${inRange ? "within range" : "outside estimate"}`);
  } catch (error) {
    console.log(`${control.name} | error: ${error.message}`);
  }
}

import { buildActor } from "./lib/actor.mjs";

function headers() {
  return { "Content-Type": "application/json" };
}

export const handler = async (event) => {
  try {
    const pathParts = (event.path || "").split("/").filter(Boolean);
    const idIndex = pathParts.findIndex((part) => part === "actors");
    const id = pathParts[idIndex + 1];

    if (id && /^\d+$/.test(id)) {
      const actor = await buildActor(Number(id));
      return { statusCode: 200, headers: headers(), body: JSON.stringify(actor) };
    }

    return { statusCode: 200, headers: headers(), body: "[]" };
  } catch (err) {
    return {
      statusCode: 500,
      headers: headers(),
      body: JSON.stringify({ error: err.message, message: err.message, detail: err.message })
    };
  }
};

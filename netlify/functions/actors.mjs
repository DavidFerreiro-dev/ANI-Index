import { buildActor } from "./lib/actor.mjs";

function headers() {
  return { "Content-Type": "application/json" };
}

export const handler = async (event) => {
  const pathParts = (event.path || "").split("/").filter(Boolean);
  const idIndex = pathParts.findIndex((part) => part === "actors");
  const id = pathParts[idIndex + 1];

  if (id && /^\d+$/.test(id)) {
    try {
      const actor = await buildActor(Number(id));
      return { statusCode: 200, headers: headers(), body: JSON.stringify(actor) };
    } catch (error) {
      return { statusCode: 502, headers: headers(), body: JSON.stringify({ detail: error.message }) };
    }
  }

  try {
    return { statusCode: 200, headers: headers(), body: "[]" };
  } catch (error) {
    return { statusCode: 500, headers: headers(), body: JSON.stringify({ detail: error.message }) };
  }
};

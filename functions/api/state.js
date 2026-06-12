import { getBearerToken, isAdminToken } from "../_shared/auth.js";

const STATE_KEY = "main";
const DEFAULT_STATE = { events: [] };

function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(init.headers || {}),
    },
  });
}

async function ensureSchema(db) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    )
    .run();
}

async function readState(db) {
  await ensureSchema(db);
  const row = await db.prepare("SELECT value, version FROM app_state WHERE key = ?1").bind(STATE_KEY).first();
  if (!row) {
    await db
      .prepare("INSERT INTO app_state (key, value, version) VALUES (?1, ?2, 0)")
      .bind(STATE_KEY, JSON.stringify(DEFAULT_STATE))
      .run();
    return { state: DEFAULT_STATE, version: 0 };
  }
  return { state: JSON.parse(row.value), version: row.version };
}

function eventMap(state) {
  return new Map((state.events || []).map((event) => [event.id, event]));
}

function sameValue(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function validateStateShape(state) {
  if (!state || !Array.isArray(state.events)) return "State must contain an events array.";
  for (const event of state.events) {
    if (!event || typeof event.id !== "string" || !event.id) return "Every event needs an id.";
    if (!Array.isArray(event.players)) return "Every event needs a players array.";
    if (!Array.isArray(event.matches)) return "Every event needs a matches array.";
  }
  return "";
}

function validateNonAdminChange(previous, next) {
  const previousEvents = eventMap(previous);
  const nextEvents = eventMap(next);

  for (const id of previousEvents.keys()) {
    if (!nextEvents.has(id)) return "Only admins can delete events.";
  }

  const adminOnlyFields = [
    "name",
    "size",
    "startTime",
    "endTime",
    "time",
    "location",
    "format",
    "scoreMode",
    "scoreTarget",
    "createdAt",
    "endedAt",
  ];

  for (const [id, previousEvent] of previousEvents) {
    const nextEvent = nextEvents.get(id);
    for (const field of adminOnlyFields) {
      if (!sameValue(previousEvent[field], nextEvent[field])) {
        return "Only admins can edit event settings or end events.";
      }
    }
  }

  return "";
}

async function updateState(db, nextState, expectedVersion) {
  const result = await db
    .prepare(
      "UPDATE app_state SET value = ?1, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE key = ?2 AND version = ?3",
    )
    .bind(JSON.stringify(nextState), STATE_KEY, expectedVersion)
    .run();
  return result.meta.changes === 1;
}

async function handlePut(request, env) {
  if (!env.DB) return json({ error: "Missing D1 binding named DB." }, { status: 500 });

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const nextState = body?.state;
  const expectedVersion = Number(body?.version);
  const shapeError = validateStateShape(nextState);
  if (shapeError) return json({ error: shapeError }, { status: 400 });
  if (!Number.isInteger(expectedVersion)) return json({ error: "Missing state version." }, { status: 400 });

  const current = await readState(env.DB);
  if (current.version !== expectedVersion) {
    return json({ error: "State changed on the server.", ...current }, { status: 409 });
  }

  const admin = await isAdminToken(env, getBearerToken(request));
  if (!admin) {
    const permissionError = validateNonAdminChange(current.state, nextState);
    if (permissionError) return json({ error: permissionError }, { status: 403 });
  }

  const updated = await updateState(env.DB, nextState, expectedVersion);
  if (!updated) {
    return json({ error: "State changed on the server.", ...(await readState(env.DB)) }, { status: 409 });
  }

  return json(await readState(env.DB));
}

export async function onRequest({ request, env }) {
  if (request.method === "GET") {
    if (!env.DB) return json({ error: "Missing D1 binding named DB." }, { status: 500 });
    return json(await readState(env.DB));
  }
  if (request.method === "PUT") return handlePut(request, env);
  return json({ error: "Method not allowed." }, { status: 405, headers: { Allow: "GET, PUT" } });
}

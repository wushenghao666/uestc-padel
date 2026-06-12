import { createAdminToken, getAdminPassword } from "../../_shared/auth.js";

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

export async function onRequest({ request, env }) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, { status: 405, headers: { Allow: "POST" } });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const password = getAdminPassword(env);
  if (!password) {
    return json({ error: "ADMIN_PASSWORD is not configured." }, { status: 500 });
  }

  if (body?.password !== password) {
    return json({ error: "Invalid admin password." }, { status: 401 });
  }

  return json({ token: await createAdminToken(env) });
}

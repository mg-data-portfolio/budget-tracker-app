// Serverless sync endpoint. Stores one JSON blob per sync code in Upstash Redis.
// Requires env vars: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
export default async function handler(req, res) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return res.status(500).json({ error: "Sync backend not configured" });

  const code = String((req.query && req.query.code) || "").trim();
  if (code.length < 6) return res.status(400).json({ error: "Sync code too short (min 6 chars)" });
  const key = `budget:${code}`;

  const redis = async (command) => {
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(command),
    });
    if (!r.ok) throw new Error("redis error");
    return r.json();
  };

  try {
    if (req.method === "GET") {
      const j = await redis(["GET", key]);
      const payload = j.result ? JSON.parse(j.result) : null;
      return res.status(200).json({ payload });
    }
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      if (!body || typeof body !== "object") return res.status(400).json({ error: "Bad body" });
      await redis(["SET", key, JSON.stringify(body)]);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: "Sync failed" });
  }
}

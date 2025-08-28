import type { VercelRequest, VercelResponse } from "@vercel/node";

const OWNER = process.env.GH_OWNER!;
const REPO = process.env.GH_REPO!;
const FILE_PATH = process.env.GH_FILE_PATH || "counter.json";
const TOKEN = process.env.GH_TOKEN!;
const LABEL = process.env.BADGE_LABEL || "visits";
const THROTTLE_SECONDS = Number(process.env.THROTTLE_SECONDS || "0"); // optional

const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP8/5+hHgAHygL7dQnYqQAAAABJRU5ErkJggg==",
  "base64"
);

async function getFile() {
  const r = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(FILE_PATH)}`,
    { headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json" } }
  );
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<{ content: string; sha: string }>;
}

async function putFile(sha: string, count: number) {
  const body = {
    message: "increment counter",
    content: Buffer.from(JSON.stringify({
      schemaVersion: 1,
      label: LABEL,
      message: String(count),
      color: "blue",
      lastUpdate: Math.floor(Date.now() / 1000)
    })).toString("base64"),
    sha
  };
  const r = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(FILE_PATH)}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json" },
      body: JSON.stringify(body)
    }
  );
  if (!r.ok) throw new Error(await r.text());
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Optional: count only GitHub referrers for sanity
  const ref = req.headers.referer || "";
  const allow = /github\.com\/luca-rendina/i.test(ref) || ref === "";
  if (!allow) {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("Content-Type", "image/png");
    return res.status(200).send(PIXEL);
  }

  // Try a few times to avoid race conflicts
  let attempts = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempts++;
    try {
      const { content, sha } = await getFile();
      const decoded = Buffer.from(content, "base64").toString("utf8");
      const json = JSON.parse(decoded);
      const last = Number(json.message || "0");
      const lastUpdate = Number(json.lastUpdate || 0);
      const now = Math.floor(Date.now() / 1000);

      const shouldIncrement = THROTTLE_SECONDS > 0 ? (now - lastUpdate) >= THROTTLE_SECONDS : true;
      const next = shouldIncrement ? last + 1 : last;

      if (shouldIncrement) await putFile(sha, next);

      break;
    } catch (e: any) {
      if (attempts < 3) continue;
      break; // fail soft: still return the pixel
    }
  }

  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "image/png");
  res.status(200).send(PIXEL);
}

export default async function handler(req, res) {
  const {
    GH_OWNER,
    GH_REPO,
    GH_FILE_PATH = "counter.json",
    GH_TOKEN,
    BADGE_LABEL = "visits",
    THROTTLE_SECONDS = "0",
  } = process.env;

  const pixel = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP8/5+hHgAHygL7dQnYqQAAAABJRU5ErkJggg==",
    "base64"
  );
  const headers = {
    Authorization: `Bearer ${GH_TOKEN}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "vercel-profile-counter",
  };
  const throttle = parseInt(THROTTLE_SECONDS, 10) || 0;
  const now = Math.floor(Date.now() / 1000);

  async function getFile() {
    const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${encodeURIComponent(GH_FILE_PATH)}`;
    const r = await fetch(url, { headers });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  async function writeFile({ sha, count, lastUpdate }) {
    const contentObj = {
      schemaVersion: 1,
      label: BADGE_LABEL,
      message: String(count),
      color: "blue"
    };
    const body = {
      message: "increment counter",
      content: Buffer.from(JSON.stringify(contentObj)).toString("base64"),
    };
    if (sha) body.sha = sha;

    const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${encodeURIComponent(GH_FILE_PATH)}`;
    const r = await fetch(url, { method: "PUT", headers, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(await r.text());
  }

  try {
    const file = await getFile();
    if (!file) {
      await writeFile({ count: 1, lastUpdate: now });
    } else {
      const json = JSON.parse(Buffer.from(file.content, "base64").toString("utf8"));
      const last = parseInt(json.message || "0", 10);
      const prev = Number(json.lastUpdate || 0);
      const shouldInc = throttle === 0 || now - prev >= throttle;
      if (shouldInc) await writeFile({ sha: file.sha, count: last + 1, lastUpdate: now });
    }
  } catch (e) {
    console.error("counter error:", e);
  }

  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "image/png");
  res.status(200).send(pixel);
}

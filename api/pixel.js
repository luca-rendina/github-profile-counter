module.exports = async (req, res) => {
  const fetch = (await import("node-fetch")).default;

  const OWNER = process.env.GH_OWNER;
  const REPO = process.env.GH_REPO;
  const FILE_PATH = process.env.GH_FILE_PATH || "counter.json";
  const TOKEN = process.env.GH_TOKEN;
  const LABEL = process.env.BADGE_LABEL || "visits";

  const PIXEL = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP8/5+hHgAHygL7dQnYqQAAAABJRU5ErkJggg==",
    "base64"
  );

  async function getFile() {
    const r = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    const data = await r.json();
    return { content: data.content, sha: data.sha };
  }

  async function putFile(sha, count) {
    const body = {
      message: "increment counter",
      content: Buffer.from(
        JSON.stringify({
          schemaVersion: 1,
          label: LABEL,
          message: String(count),
          color: "blue",
        })
      ).toString("base64"),
      sha,
    };

    await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify(body),
      }
    );
  }

  try {
    const { content, sha } = await getFile();
    const decoded = Buffer.from(content, "base64").toString("utf8");
    const json = JSON.parse(decoded);
    const last = parseInt(json.message || "0", 10);
    const next = last + 1;
    await putFile(sha, next);
  } catch (e) {
    console.error(e);
  }

  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "image/png");
  res.status(200).send(PIXEL);
};

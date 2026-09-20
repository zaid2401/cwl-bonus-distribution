import fs from "node:fs";
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
  }),
);
const base = env.COC_API_BASE || "https://cocproxy.royaleapi.dev/v1";
const get = async (path: string) => {
  const r = await fetch(base + path, { headers: { Authorization: `Bearer ${env.COC_API_TOKEN}` } });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
};
const clan = await get(`/clans/${encodeURIComponent("#9JUVCV0L")}/members?limit=3`);
const tag = clan.items[0].tag;
const p = await get(`/players/${encodeURIComponent(tag)}`);
console.log("TOP-LEVEL KEYS:", Object.keys(p).filter((k) => !Array.isArray(p[k])).map((k) => `${k}=${JSON.stringify(p[k])}`.slice(0, 90)).join("\n  "));
console.log("\nARRAY KEYS:", Object.keys(p).filter((k) => Array.isArray(p[k])));
console.log("\nACHIEVEMENTS (attack/donation related):");
for (const a of p.achievements ?? [])
  if (/battle|attack|victor|conquer|friend|season|multiplayer|war|trophy|trophies|league/i.test(a.name + " " + a.info))
    console.log(`  ${a.name.padEnd(24)} value=${String(a.value).padEnd(10)} target=${a.target} | ${a.info}`);

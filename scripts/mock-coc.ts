// Fake Clash of Clans API for local testing. Run: npm run mock-coc
// Then start the app with COC_API_BASE=http://localhost:4010/v1 COC_API_TOKEN=test
import http from "node:http";

let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (n: number) => Math.floor(rnd() * n);

const CLAN_TAGS = ["#2QQ8PL", "#2QQ8PC", "#2QQ8PJ", "#2QQ8PG", "#2QQ8PR", "#2QQ8PY", "#2QQ8PU", "#2QQ8PV"];
const SEASON = "2026-09";
const SIZE = 15;
const LAST_ROUND_LIVE = process.env.MOCK_LIVE === "1";

const clans = CLAN_TAGS.map((tag, ci) => ({
  tag,
  name: ci === 0 ? "JPA CWL Mock" : ci === 1 ? "JPA CWL Mock 2" : `Enemy ${ci}`,
  members: Array.from({ length: SIZE + 3 }, (_, i) => ({
    tag: `#${"PLQGRJCUV"[ci]}${"289PYLQGRJCUV"[i % 13]}${"289PYLQGRJCUV"[(i * 7) % 13]}Q${i}`.replace(/1/g, "Y"),
    name: `${ci === 0 ? "Hero" : ci === 1 ? "Late" : "Foe"}${i + 1}`,
    townHallLevel: 17 - (i % 3),
  })),
}));

// Round-robin schedule for 8 clans over 7 rounds.
const rounds: { warTags: string[] }[] = [];
const wars = new Map<string, unknown>();
const order = [...clans.keys()];
for (let r = 0; r < 7; r++) {
  const tags: string[] = [];
  for (let k = 0; k < 4; k++) {
    const a = clans[order[k]];
    const b = clans[order[7 - k]];
    const tag = `#8${"PYLQGRJ"[r]}${"CUVP"[k]}2Q`;
    tags.push(tag);
    const side = (c: typeof a, opp: typeof a) => {
      const lineup = c.members.slice(0, SIZE);
      const members = lineup.map((m, i) => {
        // Hero3 misses round 2; Hero5 hits low bases late (star-steal); others hit mirror
        const miss = (m.name === "Hero3" && r === 1) || (m.name === "Late2" && r > 3) || rnd() < 0.03;
        let def = i;
        if (m.name === "Hero5" && r >= 4) def = SIZE - 1;
        const stars = pick(3) + 1;
        return {
          tag: m.tag,
          name: m.name,
          townhallLevel: m.townHallLevel,
          mapPosition: i + 1,
          attacks: miss || (r === 6 && LAST_ROUND_LIVE) ? [] : [{ attackerTag: m.tag, defenderTag: opp.members[def].tag, stars, destructionPercentage: 50 + stars * 15, order: i + 1 }],
        };
      });
      const stars = members.reduce((n, m) => n + (m.attacks[0]?.stars ?? 0), 0);
      return { tag: c.tag, name: c.name, stars, destructionPercentage: 60 + pick(40), members };
    };
    // Last round is still in war
    wars.set(tag, { state: r === 6 && LAST_ROUND_LIVE ? "inWar" : "warEnded", teamSize: SIZE, clan: side(a, b), opponent: side(b, a) });
  }
  rounds.push({ warTags: tags });
  order.splice(1, 0, order.pop()!);
}

const json = (res: http.ServerResponse, code: number, body: unknown) => {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

http
  .createServer((req, res) => {
    const url = decodeURIComponent(req.url ?? "");
    if (req.headers.authorization !== "Bearer test") return json(res, 403, { reason: "accessDenied", message: "bad token" });
    let m: RegExpExecArray | null;
    if ((m = /^\/v1\/clans\/(#[^/]+)\/currentwar\/leaguegroup/.exec(url))) {
      if (!CLAN_TAGS.slice(0, 2).includes(m[1])) return json(res, 404, { reason: "notFound" });
      return json(res, 200, { state: "inWar", season: SEASON, clans, rounds });
    }
    if ((m = /^\/v1\/clanwarleagues\/wars\/(#[^/?]+)/.exec(url))) {
      const w = wars.get(m[1]);
      return w ? json(res, 200, w) : json(res, 404, { reason: "notFound" });
    }
    if ((m = /^\/v1\/clans\/(#[^/?]+)\/members/.exec(url))) {
      const c = clans.find((x) => x.tag === m![1]);
      if (!c) return json(res, 404, { reason: "notFound" });
      return json(res, 200, { items: c.members.map((x, i) => ({ ...x, donations: 5000 - i * 250, donationsReceived: 1000 + i * 10 })) });
    }
    if ((m = /^\/v1\/clans\/(#[^/?]+)$/.exec(url))) {
      const c = clans.find((x) => x.tag === m![1]);
      return c ? json(res, 200, { tag: c.tag, name: c.name }) : json(res, 404, { reason: "notFound" });
    }
    if (url.startsWith("/v1/locations")) return json(res, 200, { items: [{ id: 1 }] });
    json(res, 404, { reason: "notFound", message: url });
  })
  .listen(4010, () => console.log("Mock CoC API on http://localhost:4010/v1"));

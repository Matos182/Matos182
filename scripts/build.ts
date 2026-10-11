// Builds assets/languages.svg and the repo table in README.md from public repos.
// Each repo weighs the same, so one large fork cannot drown the rest.
const USER = "Matos182";
const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const get = async (url: string) => {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
};

const COLORS: Record<string, string> = {
  TypeScript: "#3178c6", JavaScript: "#f1e05a", Python: "#3572A5", Go: "#00ADD8",
  Dart: "#00B4AB", C: "#555555", "C++": "#f34b7d", Lua: "#000080", Shell: "#89e051",
  HTML: "#e34c26", CSS: "#563d7c", Svelte: "#ff3e00", Rust: "#dea584", CMake: "#DA3434",
  Assembly: "#6E4C13", Dockerfile: "#384d54", Other: "#8b949e",
};

const repos = (await get(`https://api.github.com/users/${USER}/repos?per_page=100&type=owner&sort=pushed`))
  .filter((r: any) => !r.private && r.name !== USER);

const share: Record<string, number> = {};
const top: Record<string, string> = {};
for (const r of repos) {
  const langs: Record<string, number> = await get(r.languages_url);
  top[r.name] = Object.entries(langs).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  const total = Object.values(langs).reduce((a, b) => a + b, 0);
  for (const [lang, bytes] of Object.entries(langs)) share[lang] = (share[lang] ?? 0) + bytes / total;
}

const sum = Object.values(share).reduce((a, b) => a + b, 0);
let slices = Object.entries(share).map(([name, v]) => ({ name, pct: v / sum })).sort((a, b) => b.pct - a.pct);
const small = slices.filter((s) => s.pct < 0.03);
slices = slices.filter((s) => s.pct >= 0.03);
if (small.length) slices.push({ name: "Other", pct: small.reduce((a, s) => a + s.pct, 0) });

// Donut: one arc path per slice, so every SVG renderer draws it.
const R = 60, CX = 90, CY = 90;
const point = (t: number) => [CX + R * Math.sin(2 * Math.PI * t), CY - R * Math.cos(2 * Math.PI * t)].map((n) => n.toFixed(2)).join(" ");
let start = 0;
const arcs = slices.map((s) => {
  const end = Math.min(start + s.pct, 0.9999);
  const arc = `<path d="M ${point(start)} A ${R} ${R} 0 ${s.pct > 0.5 ? 1 : 0} 1 ${point(end)}" fill="none" stroke="${COLORS[s.name] ?? COLORS.Other}" stroke-width="26"/>`;
  start += s.pct;
  return arc;
}).join("\n  ");
const legend = slices.map((s, i) =>
  `<g transform="translate(200 ${34 + i * 22})"><circle r="6" cx="6" cy="-4" fill="${COLORS[s.name] ?? COLORS.Other}"/><text x="20" y="0">${s.name}</text><text x="190" y="0" text-anchor="end" class="muted">${(s.pct * 100).toFixed(1)}%</text></g>`
).join("\n  ");
const height = Math.max(190, 34 + slices.length * 22);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="${height}" viewBox="0 0 420 ${height}" font-family="-apple-system,Segoe UI,Helvetica,Arial,sans-serif" font-size="13">
  <style>text{fill:#24292f}.muted{fill:#57606a}.big{font-size:22px;font-weight:600}@media (prefers-color-scheme:dark){text{fill:#e6edf3}.muted{fill:#8b949e}}</style>
  ${arcs}
  <text x="90" y="92" text-anchor="middle" class="big">${repos.length}</text>
  <text x="90" y="110" text-anchor="middle" class="muted">repos</text>
  ${legend}
</svg>
`;
await Bun.write("assets/languages.svg", svg);

const clip = (s: string) => (s.length > 72 ? s.slice(0, 71).trimEnd() + "…" : s);
const rows = repos.map((r: any) =>
  `| ${r.fork ? "🍴" : "📦"} [${r.name}](${r.html_url}) | ${clip(r.description ?? "").replace(/\|/g, "\\|")} | ${top[r.name]} |`
).join("\n");
const own = repos.filter((r: any) => !r.fork).length;
const table = `<!-- REPOS:START -->
<p align="center"><img src="assets/languages.svg" alt="Languages across my public repos" /></p>

<p align="center"><sub>${own} own · ${repos.length - own} forks · every repo weighs the same</sub></p>

| Repo | About | Main |
|---|---|---|
${rows}
<!-- REPOS:END -->`;

const readme = await Bun.file("README.md").text();
await Bun.write("README.md", readme.replace(/<!-- REPOS:START -->[\s\S]*<!-- REPOS:END -->/, table));

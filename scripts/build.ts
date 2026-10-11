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
  Dart: "#00B4AB", C: "#a8b9cc", "C++": "#f34b7d", Lua: "#6b7cff", Shell: "#89e051",
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
const ranked = Object.entries(share).map(([name, v]) => ({ name, pct: v / sum })).sort((a, b) => b.pct - a.pct);
const slices = ranked.slice(0, 8);
if (ranked.length > 8) slices.push({ name: "Other", pct: ranked.slice(8).reduce((a, s) => a + s.pct, 0) });

// Thin ring: one arc path per slice with a small gap, so it reads clean at any size.
const R = 64, CX = 84, CY = 92, GAP = 0.012;
const point = (t: number) => [CX + R * Math.sin(2 * Math.PI * t), CY - R * Math.cos(2 * Math.PI * t)].map((n) => n.toFixed(2)).join(" ");
let start = 0;
const arcs = slices.map((s) => {
  const a = start + GAP / 2, b = start + s.pct - GAP / 2;
  start += s.pct;
  return `<path d="M ${point(a)} A ${R} ${R} 0 ${b - a > 0.5 ? 1 : 0} 1 ${point(b)}" fill="none" stroke="${COLORS[s.name] ?? COLORS.Other}" stroke-width="7" stroke-linecap="round"/>`;
}).join("\n  ");
const legend = slices.map((s, i) =>
  `<g transform="translate(196 ${36 + i * 19})"><circle r="3.5" cx="4" cy="-4" fill="${COLORS[s.name] ?? COLORS.Other}"/><text x="16" y="0">${s.name}</text><text x="196" y="0" text-anchor="end" class="muted">${(s.pct * 100).toFixed(1)}%</text></g>`
).join("\n  ");

const height = Math.max(168, 36 + slices.length * 19);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="${height}" viewBox="0 0 400 ${height}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif" font-size="12">
  <style>text{fill:#1f2328}.muted{fill:#656d76}.big{font-size:28px;font-weight:300}.cap{font-size:9px;letter-spacing:2px}@media (prefers-color-scheme:dark){text{fill:#e6edf3}.muted{fill:#7d8590}}</style>
  ${arcs}
  <text x="${CX}" y="${CY + 6}" text-anchor="middle" class="big">${repos.length}</text>
  <text x="${CX}" y="${CY + 22}" text-anchor="middle" class="muted cap">REPOS</text>
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

| Repo | About | Main |
|---|---|---|
${rows}
<!-- REPOS:END -->`;

const readme = await Bun.file("README.md").text();
await Bun.write("README.md", readme.replace(/<!-- REPOS:START -->[\s\S]*<!-- REPOS:END -->/, table));

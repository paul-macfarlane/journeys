// oklch -> sRGB -> WCAG contrast for the palette in docs/branding.md.
// Usage: node scripts/contrast.mjs '{"light":{"background":[0.985,0.005,150],...},"dark":{...}}'
// (each token as [L, C, h]); prints hex values and the WCAG ratios per pair.
function oklchToSrgb(L, C, h) {
  const hr = (h * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3,
    m = m_ ** 3,
    s = s_ ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return [r, g, bb].map((v) => Math.min(1, Math.max(0, v)));
}
const lin = (v) => v; // already linear
function lum([r, g, b]) {
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function toHex(rgb) {
  return (
    "#" +
    rgb
      .map((v) => {
        const s = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
        return Math.round(s * 255)
          .toString(16)
          .padStart(2, "0");
      })
      .join("")
  );
}
export function ratio(a, b) {
  const la = lum(oklchToSrgb(...a)),
    lb = lum(oklchToSrgb(...b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
const P = JSON.parse(process.argv[2]);
for (const theme of ["light", "dark"]) {
  const t = P[theme];
  console.log(`== ${theme}`);
  for (const [k, v] of Object.entries(t))
    console.log(`  ${k}: oklch(${v.join(" ")}) ${toHex(oklchToSrgb(...v))}`);
  const pairs = [
    ["foreground", "background"],
    ["muted-foreground", "background"],
    ["foreground", "card"],
    ["muted-foreground", "card"],
    ["primary-foreground", "primary"],
    ["foreground", "muted"],
    ["muted-foreground", "muted"],
    ["primary", "background"],
    ["destructive", "background"],
  ];
  for (const [a, b] of pairs)
    if (t[a] && t[b])
      console.log(`  ${a} on ${b}: ${ratio(t[a], t[b]).toFixed(2)}`);
}

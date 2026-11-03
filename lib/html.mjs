export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const STYLES = `
:root{--bg:#fafaf9;--fg:#1c1917;--muted:#57534e;--line:#e7e5e4;--accent:#1c1917;--accent-fg:#fafaf9}
@media (prefers-color-scheme:dark){:root{--bg:#141414;--fg:#f5f5f4;--muted:#a8a29e;--line:#2e2e2e;--accent:#f5f5f4;--accent-fg:#141414}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:640px;margin:0 auto;padding:56px 16px 80px}
.brand{font-weight:700;letter-spacing:.12em;font-size:13px;margin:0 0 40px}
h1{font-size:28px;line-height:1.2;margin:0 0 16px}
h2{font-size:18px;margin:32px 0 8px}
p,li{color:var(--muted)}
strong{color:var(--fg)}
a{color:var(--fg)}
button{margin-top:16px;padding:12px 20px;border:0;border-radius:8px;background:var(--accent);color:var(--accent-fg);font:inherit;font-weight:600;cursor:pointer}
button:focus-visible,a:focus-visible{outline:2px solid var(--fg);outline-offset:3px}
footer{margin-top:48px;padding-top:16px;border-top:1px solid var(--line);font-size:14px}
`;

export function page(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<style>${STYLES}</style>
</head>
<body>
<main>
<p class="brand">MODUS</p>
${body}
<footer><a href="/privacy">Privacy notice</a></footer>
</main>
</body>
</html>`;
}

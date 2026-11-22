export interface LandingReadout {
  readonly label: string;
  readonly value: string;
}

export interface LandingPageConfig {
  readonly title: string;
  readonly subtitle?: string;
  readonly accentColor: string;
  readonly avatarSrc: string;
  readonly language: string;
  readonly eyebrow: string;
  readonly readouts: readonly LandingReadout[];
}

export interface StaticHtmlResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

export interface NeutralNotFoundResponse {
  readonly status: 404;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

export class InvalidLandingPageConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidLandingPageConfigError';
  }
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const SAFE_AVATAR_SRC = /^data:image\/(png|jpeg|svg\+xml);base64,[A-Za-z0-9+/=]+$/;
const SAFE_LANGUAGE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const CACHE_SECONDS = 300;

export const LANDING_PAGE_HEADERS: Readonly<Record<string, string>> = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
  'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

export const NEUTRAL_NOT_FOUND_BODY = '{"statusCode":404,"message":"Not Found"}';

export const NEUTRAL_NOT_FOUND: NeutralNotFoundResponse = {
  status: 404,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  },
  body: NEUTRAL_NOT_FOUND_BODY,
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const assertValid = (config: LandingPageConfig): void => {
  if (!HEX_COLOR.test(config.accentColor)) {
    throw new InvalidLandingPageConfigError(
      'Landing page accent colour must be a #rrggbb hex value',
    );
  }
  if (!SAFE_AVATAR_SRC.test(config.avatarSrc)) {
    throw new InvalidLandingPageConfigError(
      'Landing page avatar must be a base64 png, jpeg or svg data URI',
    );
  }
  if (!SAFE_LANGUAGE.test(config.language)) {
    throw new InvalidLandingPageConfigError('Landing page language must be a BCP 47 tag');
  }
};

const renderReadouts = (readouts: readonly LandingReadout[]): string =>
  readouts
    .map(({ label, value }) => `<li><span>${escapeHtml(label)}</span> ${escapeHtml(value)}</li>`)
    .join('');

const landingStyles = (accent: string): string => `*{box-sizing:border-box}
html{height:100%}
body{min-height:100%;margin:0}
body{position:relative;display:flex;align-items:center;justify-content:center;overflow-x:hidden;color:#cfe8f5;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:radial-gradient(ellipse 50% 60% at 50% 48%,#0a2a3d,transparent 75%),radial-gradient(ellipse 120% 100% at 50% 50%,#04141e 40%,#010609 100%)}
.tower{position:fixed;top:0;bottom:0;left:50%;width:min(340px,70vw);transform:translateX(-50%);pointer-events:none;background:linear-gradient(90deg,transparent 0 18%,#071a26 18% 30%,#0a2230 30% 70%,#071a26 70% 82%,transparent 82%);opacity:.8;-webkit-mask-image:linear-gradient(transparent,#000 25%,#000 75%,transparent);mask-image:linear-gradient(transparent,#000 25%,#000 75%,transparent)}
.lines{position:fixed;left:50%;width:min(170px,34vw);transform:translateX(-50%);height:96px;pointer-events:none;background:repeating-linear-gradient(0deg,${accent}55 0 1px,transparent 1px 12px);opacity:.45}
.lines.top{top:6vh}
.lines.bottom{bottom:6vh}
.rail{position:fixed;top:50%;width:min(24vw,240px);height:1px;pointer-events:none;background:linear-gradient(90deg,transparent,${accent}88);transform:translateY(-70px)}
.rail.left{right:calc(50% + 120px)}
.rail.right{left:calc(50% + 120px);transform:translateY(-70px) scaleX(-1)}
.hud{position:fixed;top:34px;left:32px;font-size:11px;line-height:1.7;letter-spacing:.12em}
.hud strong{display:block;font-weight:500;color:#ff7a4d;text-transform:uppercase}
.hud span{display:block;color:#7fa3b8}
.hud i{position:relative;display:block;width:120px;height:3px;margin-top:8px;background:#0f2a3a}
.hud i::before{content:"";position:absolute;inset:0 auto 0 0;width:100%;background:${accent};transform-origin:left;animation:load 6s ease-in-out infinite}
.dots{position:fixed;top:34px;right:28px;display:flex;flex-direction:column;gap:10px}
.dots b{width:7px;height:7px;border-radius:50%;border:1px solid ${accent}88}
.dots b:first-child{background:${accent}88}
main{position:relative;padding:24px;max-width:560px;text-align:center}
.avatar{display:block;width:clamp(200px,46vw,300px);height:clamp(200px,46vw,300px);margin:0 auto;mix-blend-mode:screen;-webkit-mask-image:radial-gradient(circle,#000 58%,transparent 74%);mask-image:radial-gradient(circle,#000 58%,transparent 74%)}
h1{margin:34px 0 10px;font-size:clamp(26px,7vw,38px);font-weight:500;line-height:1.1;letter-spacing:.14em;text-transform:uppercase;color:#eafaff;text-shadow:0 0 18px ${accent}aa}
.subtitle{margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:16px;line-height:1.55;color:#7fa3b8}
ul{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 26px;margin:34px 0 0;padding:0;list-style:none;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:${accent}}
li span{color:#4f7185}
.scan{position:fixed;left:0;right:0;top:0;height:120px;pointer-events:none;background:linear-gradient(transparent,${accent}1f 90%,${accent}66);animation:scan 7s linear infinite}
.hud,.dots,main>*{animation:boot .9s ease-out both}
.tower{animation:fade 1.2s ease-out both}
.hud{animation-delay:.1s}
.dots{animation-delay:.2s}
.lines{animation:fade 1s ease-out .3s both,shimmer 5s ease-in-out 1.3s infinite}
main>.avatar{animation:boot 1.1s ease-out .35s both,breathe 4.5s ease-in-out 1.5s infinite}
main>h1{animation-delay:.75s}
main>ul{animation-delay:1.05s}
.rail{animation:draw 1.2s ease-out .5s both}
.dots b{animation:blink 3.2s steps(1) infinite}
.dots b:nth-child(2){animation-delay:.4s}
.dots b:nth-child(3){animation-delay:.9s}
.dots b:nth-child(4){animation-delay:1.5s}
li{animation:flicker 6s steps(1) infinite}
li:nth-child(2){animation-delay:1.7s}
li:nth-child(3){animation-delay:3.1s}
h1::after{content:"_";content:"_"/"";margin-left:2px;color:${accent};animation:caret 1s steps(1) infinite}
@keyframes boot{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes fade{from{opacity:0}}
@keyframes draw{from{opacity:0;clip-path:inset(0 100% 0 0)}to{opacity:1;clip-path:inset(0)}}
@keyframes scan{from{transform:translateY(-130px)}to{transform:translateY(100vh)}}
@keyframes breathe{50%{filter:brightness(1.3) saturate(1.15)}}
@keyframes shimmer{50%{opacity:.3}}
@keyframes load{0%{transform:scaleX(.15)}60%{transform:scaleX(1)}100%{transform:scaleX(.15)}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.25}}
@keyframes flicker{0%,90%,94%,100%{opacity:1}92%,96%{opacity:.4}}
@keyframes caret{50%{opacity:0}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important}}
@media (max-height:560px){.avatar{width:140px;height:140px}}
@media (max-width:640px){.rail,.tower,.lines.top{display:none}.hud{left:18px;top:20px}}
`;

export const renderLandingPage = (config: LandingPageConfig): StaticHtmlResponse => {
  assertValid(config);
  const accent = config.accentColor;
  const title = escapeHtml(config.title);
  const subtitle =
    config.subtitle === undefined ? '' : `<p class="subtitle">${escapeHtml(config.subtitle)}</p>`;
  const eyebrow = escapeHtml(config.eyebrow);
  const readouts = renderReadouts(config.readouts);
  const body = `<!doctype html>
<html lang="${config.language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<meta name="color-scheme" content="dark">
<title>${title}</title>
<style>
${landingStyles(accent)}</style>
</head>
<body>
<div class="scan"></div>
<div class="tower"></div>
<div class="lines top"></div>
<div class="lines bottom"></div>
<div class="rail left"></div>
<div class="rail right"></div>
<div class="hud"><strong>${eyebrow}</strong><span>${title}</span><i></i></div>
<div class="dots"><b></b><b></b><b></b><b></b></div>
<main>
<img class="avatar" src="${config.avatarSrc}" width="300" height="300" alt="">
<h1>${title}</h1>
${subtitle}
<ul>${readouts}</ul>
</main>
</body>
</html>
`;
  return { status: 200, headers: LANDING_PAGE_HEADERS, body };
};

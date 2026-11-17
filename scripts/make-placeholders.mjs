// Gera imagens SVG de exemplo em public/placeholders (substitua pelas suas fotos no painel).
import { writeFileSync, mkdirSync } from 'node:fs';
const dir = new URL('../public/placeholders/', import.meta.url);
mkdirSync(dir, { recursive: true });

const gold = '#b08d57', ink = '#2a2622';
const wrap = (a, b, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" role="img"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="800" height="800" fill="url(#g)"/><g fill="none" stroke="${gold}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;

const phone = `<rect x="250" y="110" width="300" height="580" rx="52"/>`;
const shapes = {
  produto: ['#f3ece3', '#e2d4bf', `${phone}<path d="M350 150h100"/><circle cx="400" cy="640" r="14"/>`],
  case: ['#f1e9df', '#ddcdb6', `<rect x="250" y="110" width="300" height="580" rx="52" fill="${ink}" fill-opacity=".88"/><rect x="285" y="145" width="110" height="110" rx="26"/><circle cx="318" cy="178" r="16"/><circle cx="362" cy="222" r="16"/><circle cx="318" cy="222" r="6" fill="${gold}"/>`],
  film: ['#eef0f2', '#d9dde2', `${phone}<rect x="272" y="140" width="256" height="520" rx="26" stroke-width="5"/><path d="M300 600L500 200M360 640L520 320" stroke-width="6" opacity=".6"/>`],
  charger: ['#f4ece2', '#e5d6bf', `<rect x="290" y="230" width="220" height="250" rx="28" fill="#fff" fill-opacity=".7"/><path d="M350 230v-60M450 230v-60"/><path d="M400 480v60c0 90 140 60 140 150" stroke-width="12"/><circle cx="400" cy="355" r="26"/>`],
  wireless: ['#efe8df', '#dccfbb', `<ellipse cx="400" cy="560" rx="230" ry="60" fill="#fff" fill-opacity=".6"/><ellipse cx="400" cy="540" rx="170" ry="38"/><rect x="300" y="130" width="200" height="360" rx="38"/><path d="M350 300l50 60 50-60" stroke-width="8"/>`],
  cable: ['#f2ebe4', '#e0d1bc', `<rect x="130" y="320" width="90" height="60" rx="14" fill="#fff" fill-opacity=".7"/><path d="M220 350c180 0 120 200 260 200"/><rect x="580" y="520" width="90" height="60" rx="14" fill="#fff" fill-opacity=".7"/><path d="M480 550h100"/>`],
  earbuds: ['#f6f0e7', '#e5d7c2', `<rect x="170" y="440" width="460" height="230" rx="110" fill="#fff" fill-opacity=".6"/><path d="M170 560h460"/><circle cx="290" cy="250" r="62" fill="${ink}" fill-opacity=".85"/><path d="M335 290l15 130"/><circle cx="510" cy="250" r="62" fill="${ink}" fill-opacity=".85"/><path d="M465 290l-15 130"/>`],
  powerbank: ['#efe9e1', '#ddd0bd', `<rect x="270" y="150" width="260" height="500" rx="40" fill="${ink}" fill-opacity=".88"/><circle cx="330" cy="230" r="9" fill="${gold}"/><circle cx="370" cy="230" r="9" fill="${gold}"/><circle cx="410" cy="230" r="9" fill="${gold}"/><circle cx="450" cy="230" r="9"/><rect x="350" y="590" width="100" height="24" rx="8"/>`],
  holder: ['#f3ece3', '#e2d3be', `<rect x="470" y="120" width="190" height="320" rx="34" transform="rotate(14 565 280)"/><path d="M420 420c-90 0-130 90-130 170"/><circle cx="290" cy="640" r="55" fill="#fff" fill-opacity=".6"/>`],
};
for (const [name, [a, b, body]] of Object.entries(shapes)) writeFileSync(new URL(`${name}.svg`, dir), wrap(a, b, body));

const banner = (a, b, c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 700" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="1600" height="700" fill="url(#g)"/><g fill="none" stroke="${c}" stroke-width="4" opacity=".55"><rect x="1080" y="110" width="250" height="480" rx="44"/><rect x="1110" y="140" width="190" height="420" rx="28" stroke-width="2"/><circle cx="1205" cy="525" r="10"/><path d="M1130 600c-60 60-160 20-240 80"/></g></svg>`;
writeFileSync(new URL('banner-1.svg', dir), banner('#f3ebe0', '#e2cfb2', '#b08d57'));
writeFileSync(new URL('banner-2.svg', dir), banner('#2b2622', '#4a3f35', '#d9b97b'));
console.log('placeholders ok');

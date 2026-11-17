// Gera imagens SVG elegantes de exemplo em public/placeholders (substitua pelas suas fotos no painel).
import { writeFileSync, mkdirSync } from 'node:fs';
const dir = new URL('../public/placeholders/', import.meta.url);
mkdirSync(dir, { recursive: true });

const bg = (a, b) => `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="800" height="800" fill="url(#g)"/>`;
const gold = '#b08d57', ink = '#2a2622';
const wrap = (a, b, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" role="img">${bg(a, b)}<g fill="none" stroke="${gold}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;

const shapes = {
  earrings: ['#f6efe6', '#e8dccb', `<circle cx="300" cy="300" r="12" fill="${gold}"/><path d="M300 312v90"/><path d="M300 402c-40 40-40 100 0 130 40-30 40-90 0-130z" fill="#fff6e3"/><circle cx="500" cy="300" r="12" fill="${gold}"/><path d="M500 312v90"/><path d="M500 402c-40 40-40 100 0 130 40-30 40-90 0-130z" fill="#fff6e3"/>`],
  'earrings-2': ['#f2ebe4', '#e3d3c0', `<circle cx="300" cy="400" r="110"/><circle cx="500" cy="400" r="110"/><circle cx="300" cy="290" r="14" fill="${gold}"/><circle cx="500" cy="290" r="14" fill="${gold}"/>`],
  necklace: ['#f7f1e8', '#e6d8c4', `<path d="M170 220c40 300 420 300 460 0"/><path d="M400 395v40"/><path d="M400 435l-34 40 34 50 34-50z" fill="#fff6e3"/>`],
  'necklace-2': ['#efe9e1', '#ddd0bd', `<path d="M170 240c40 300 420 300 460 0" stroke-dasharray="1 28" stroke-width="26"/><circle cx="400" cy="460" r="34" fill="#fff6e3"/>`],
  ring: ['#f4ece2', '#e7d6bd', `<circle cx="400" cy="460" r="150"/><path d="M360 300l40-70 40 70-40 40z" fill="#fff6e3"/>`],
  'ring-2': ['#f1eae1', '#dfd0ba', `<ellipse cx="400" cy="420" rx="180" ry="160"/><ellipse cx="400" cy="420" rx="150" ry="130"/>`],
  bracelet: ['#f6f0e7', '#e5d7c2', `<ellipse cx="400" cy="400" rx="230" ry="150" stroke-dasharray="46 18" stroke-width="22"/>`],
  watch: ['#efe8df', '#dccfbb', `<path d="M320 120h160l20 140H300z"/><path d="M300 540h200l-20 140H320z"/><circle cx="400" cy="400" r="150"/><circle cx="400" cy="400" r="120" stroke-width="4"/><path d="M400 400V320M400 400l60 30" stroke-width="8"/>`],
  sunglasses: ['#f3ece3', '#e2d4bf', `<rect x="130" y="320" width="230" height="170" rx="70" fill="${ink}" fill-opacity=".85"/><rect x="440" y="320" width="230" height="170" rx="70" fill="${ink}" fill-opacity=".85"/><path d="M360 380c25-20 55-20 80 0"/><path d="M130 360L80 330M670 360l50-30"/>`],
  bag: ['#f1e9df', '#ddcdb6', `<rect x="170" y="320" width="460" height="320" rx="40" fill="${ink}" fill-opacity=".9"/><path d="M290 320c0-120 220-120 220 0"/><circle cx="400" cy="470" r="22" fill="${gold}"/>`],
};
for (const [name, [a, b, body]] of Object.entries(shapes)) writeFileSync(new URL(`${name}.svg`, dir), wrap(a, b, body));

const banner = (a, b, c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 700" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="1600" height="700" fill="url(#g)"/><g fill="none" stroke="${c}" stroke-width="3" opacity=".5"><circle cx="1250" cy="350" r="260"/><circle cx="1250" cy="350" r="200"/><circle cx="1250" cy="350" r="140"/><circle cx="1250" cy="350" r="12" fill="${c}"/></g></svg>`;
writeFileSync(new URL('banner-1.svg', dir), banner('#f3ebe0', '#e2cfb2', '#b08d57'));
writeFileSync(new URL('banner-2.svg', dir), banner('#2b2622', '#4a3f35', '#d9b97b'));
console.log('placeholders ok');

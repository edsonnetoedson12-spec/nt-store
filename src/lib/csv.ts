/** CSV compatível com Excel brasileiro: separador ";", BOM UTF-8, decimais com vírgula. */

const SEP = ';';

/** Neutraliza fórmulas (=, +, -, @) para evitar injeção de planilha. */
function safe(v: string): string {
  return /^[=+\-@\t\r]/.test(v) && !/^-?\d+([.,]\d+)?$/.test(v) ? `'${v}` : v;
}

export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = safe(typeof v === 'number' ? String(v).replace('.', ',') : String(v));
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(SEP), ...rows.map((r) => r.map(csvCell).join(SEP))];
  return '﻿' + lines.join('\r\n');
}

/** Lê CSV (aceita ; , ou tab, aspas e BOM). Retorna linhas de células. */
export function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, '');
  const first = t.split(/\r?\n/, 1)[0] ?? '';
  const sep = [';', ',', '\t'].map((c) => [c, first.split(c).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') {
        if (t[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

/** "1.234,56" | "1234.56" | "R$ 12,5" → número (ou null). */
export function parseMoney(v: string | undefined): number | null {
  if (v == null) return null;
  let s = v.replace(/[^\d,.\-]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export type ProductImportRow = {
  sku: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  promo_price: number | null;
  cost: number;
  stock: number;
  min_stock: number;
  active: boolean;
};

export const PRODUCT_HEADERS = ['sku', 'nome', 'marca', 'categoria', 'preco', 'preco_promocional', 'custo', 'estoque', 'estoque_minimo', 'ativo'];

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');

/** Valida a planilha de produtos. Nunca lança: devolve linhas válidas e erros por linha. */
export function parseProductCsv(text: string): { rows: ProductImportRow[]; errors: string[] } {
  const data = parseCsv(text);
  const errors: string[] = [];
  const rows: ProductImportRow[] = [];
  if (data.length < 2) return { rows, errors: ['Planilha vazia'] };
  const head = data[0].map(norm);
  const idx = (...names: string[]) => head.findIndex((h) => names.includes(h));
  const col = {
    sku: idx('sku', 'codigo'), name: idx('nome', 'name', 'produto'), brand: idx('marca', 'brand'),
    category: idx('categoria', 'category'), price: idx('preco', 'preco_de_venda', 'price'),
    promo: idx('preco_promocional', 'promocao', 'promo'), cost: idx('custo', 'cost'),
    stock: idx('estoque', 'stock', 'quantidade'), min: idx('estoque_minimo', 'minimo'), active: idx('ativo', 'active'),
  };
  if (col.name < 0 || col.price < 0) return { rows, errors: ['A planilha precisa das colunas "nome" e "preco"'] };
  const seen = new Set<string>();
  data.slice(1).forEach((r, i) => {
    const line = i + 2;
    const get = (c: number) => (c >= 0 ? (r[c] ?? '').trim() : '');
    const name = get(col.name);
    const price = parseMoney(get(col.price));
    if (!name) return void errors.push(`Linha ${line}: nome vazio`);
    if (price == null || price < 0) return void errors.push(`Linha ${line}: preço inválido`);
    const promo = get(col.promo) ? parseMoney(get(col.promo)) : null;
    if (promo != null && (promo < 0 || promo >= price)) return void errors.push(`Linha ${line}: preço promocional deve ser menor que o preço`);
    const cost = parseMoney(get(col.cost)) ?? 0;
    const stock = Math.max(0, Math.floor(parseMoney(get(col.stock)) ?? 0));
    const min = Math.max(0, Math.floor(parseMoney(get(col.min)) ?? 5));
    const sku = get(col.sku);
    if (sku) {
      if (seen.has(sku.toLowerCase())) return void errors.push(`Linha ${line}: SKU "${sku}" repetido na planilha`);
      seen.add(sku.toLowerCase());
    }
    const act = norm(get(col.active));
    rows.push({
      sku, name, brand: get(col.brand), category: get(col.category), price, promo_price: promo, cost, stock, min_stock: min,
      active: act === '' ? true : !['0', 'nao', 'n', 'false', 'inativo'].includes(act),
    });
  });
  return { rows, errors };
}

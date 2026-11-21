'use client';
import { createClient } from './supabase/client';

/** Faz a vitrine refletir a mudança na hora (limpa o cache das páginas públicas). */
export async function refreshStore(): Promise<void> {
  try {
    await fetch('/api/revalidate', { method: 'POST' });
  } catch {}
}

const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

/** Envia uma imagem para o Supabase Storage (bucket "store") e devolve a URL pública. */
export async function uploadImage(file: File, folder: string): Promise<string> {
  if (!OK_TYPES.includes(file.type)) throw new Error('Use imagens JPG, PNG, WEBP, GIF ou SVG.');
  file = await compressImage(file);
  if (file.size > 5 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 5 MB.');
  const sb = createClient();
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from('store').upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type });
  if (error) throw new Error(error.message);
  return sb.storage.from('store').getPublicUrl(path).data.publicUrl;
}

export const num = (v: string | number | null | undefined): number => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

/** Reduz a foto antes do envio (máx. 1600px, WebP): site mais rápido e menos espaço usado. */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/webp', 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' });
  } catch {
    return file;
  }
}

/** Baixa um texto como arquivo (CSV/JSON). */
export function download(name: string, content: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

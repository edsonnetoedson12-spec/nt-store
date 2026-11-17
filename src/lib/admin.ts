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

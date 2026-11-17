import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@/lib/supabase/server';

// Chamado pelo painel após salvar: faz a loja refletir a mudança na hora.
export async function POST() {
  const sb = await createServerSupabase();
  const { data: isAdmin } = await sb.rpc('is_admin');
  if (!isAdmin) return NextResponse.json({ ok: false }, { status: 403 });
  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true });
}

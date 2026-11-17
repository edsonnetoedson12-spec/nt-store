import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import AdminNav from '@/components/AdminNav';

export const metadata: Metadata = { title: 'Painel NT', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const sb = await createServerSupabase();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect('/admin/login');
  const { data: isAdmin } = await sb.rpc('is_admin');
  if (!isAdmin) redirect('/admin/login');
  return (
    <div className="admin">
      <AdminNav email={auth.user.email || ''} />
      <div className="admin-main">{children}</div>
    </div>
  );
}

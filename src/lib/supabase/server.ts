import { createServerClient } from '@supabase/ssr';
import { createClient as createSbClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/** Cliente com a sessão do usuário (cookies). Use em rotas/ações que dependem de quem está logado. */
export async function createServerSupabase() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* chamado de um Server Component: o middleware renova a sessão */
        }
      },
    },
  });
}

/** Cliente anônimo, sem cookies: para dados públicos da vitrine (permite cache). */
export function createPublicClient() {
  return createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Cliente com poder total. SOMENTE no servidor (webhooks). Nunca importe em componentes de cliente. */
export function createServiceClient() {
  return createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

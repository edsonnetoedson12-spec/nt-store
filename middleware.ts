import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Renova a sessão e bloqueia /admin para quem não está logado.
// A verificação "é administrador?" é feita no layout do admin e, principalmente, pelo RLS do banco.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  if (path.startsWith('/admin') && path !== '/admin/login' && !data.user) {
    const login = request.nextUrl.clone();
    login.pathname = '/admin/login';
    login.search = '';
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = { matcher: ['/admin/:path*'] };

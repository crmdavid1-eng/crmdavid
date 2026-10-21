import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { IS_DEMO } from "@/lib/supabase/mode";

export async function proxy(request: NextRequest) {
  if (IS_DEMO) return NextResponse.next();
  let response = NextResponse.next({ request });

  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data } = await sb.auth.getUser();
  const isLogin = request.nextUrl.pathname.startsWith("/login");

  if (!data.user && !isLogin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (data.user && isLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!api/|_next/|favicon.ico|manifest.webmanifest|icon|apple-icon|.*\\.(?:png|svg|jpg|ico)$).*)"],
};

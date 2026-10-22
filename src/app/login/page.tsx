"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    supabase().auth.getSession().then(({ data }) => data.session && router.replace("/"));
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const login = email.trim().toLowerCase();
    const { error } = await supabase().auth.signInWithPassword({
      email: login.includes("@") ? login : `${login}@crm.local`,
      password,
    });
    if (error) {
      setError("Неверный логин или пароль");
      setLoading(false);
      return;
    }
    router.replace("/");
  }

  return (
    <main className="flex min-h-full items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="h-10 w-10" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Вход в CRM</h1>
            
          </div>
        </div>
        <label className="mb-3 block">
          <span className="mb-1 block text-sm text-muted">Логин</span>
          <input className="input" type="text" autoComplete="username" autoCapitalize="none" autoCorrect="off" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="mb-4 block">
          <span className="mb-1 block text-sm text-muted">Пароль</span>
          <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full py-2.5" disabled={loading}>
          {loading ? "Входим…" : "Войти"}
        </button>
      </form>
    </main>
  );
}

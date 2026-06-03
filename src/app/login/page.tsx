import { Droplets } from "lucide-react";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-soft px-4">
      <section className="w-full max-w-md rounded-lg border border-line bg-white p-6 shadow-soft">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-aqua text-white">
            <Droplets size={24} />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-ink">Вход владельца</h1>
            <p className="text-sm text-muted">Supabase Auth можно включить после настройки проекта.</p>
          </div>
        </div>
        <form className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-ink">Email</span>
            <input className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-aqua" defaultValue={process.env.ADMIN_EMAIL ?? ""} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink">Пароль</span>
            <input type="password" className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-aqua" />
          </label>
          <button className="w-full rounded-md bg-aqua px-4 py-2 text-sm font-semibold text-white" type="button">
            Войти
          </button>
        </form>
      </section>
    </main>
  );
}

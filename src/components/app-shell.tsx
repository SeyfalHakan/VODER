import Link from "next/link";
import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  Droplets,
  Fuel,
  Home,
  PackagePlus,
  PackageX,
  Refrigerator,
  Smartphone,
  Truck,
  Users,
  WalletCards
} from "lucide-react";
import { clsx } from "clsx";

export const sections = [
  { href: "/", label: "Дашборд", icon: Home },
  { href: "/dashboard/employees", label: "Сотрудники", icon: Users },
  { href: "/dashboard/warehouses", label: "Склады", icon: Building2 },
  { href: "/dashboard/products", label: "Товары", icon: Droplets },
  { href: "/dashboard/pavilions", label: "Павильоны", icon: ClipboardList },
  { href: "/dashboard/deliveries", label: "Доставки", icon: Truck },
  { href: "/dashboard/stock-arrivals", label: "Приход", icon: PackagePlus },
  { href: "/dashboard/remaining-stock", label: "Остатки", icon: Boxes },
  { href: "/dashboard/defective-write-offs", label: "Брак", icon: PackageX },
  { href: "/dashboard/expenses", label: "Расходы", icon: Fuel },
  { href: "/dashboard/coolers", label: "Кулеры", icon: Refrigerator },
  { href: "/dashboard/reports", label: "Отчеты", icon: BarChart3 },
  { href: "/dashboard/cash", label: "Касса", icon: WalletCards }
];

const mobileTabs = [
  sections[0],
  sections[5],
  sections[6],
  sections[7],
  sections[12]
];

export function AppShell({
  children,
  active = "/"
}: {
  children: React.ReactNode;
  active?: string;
}) {
  return (
    <div className="min-h-screen bg-soft">
      <div className="flex min-h-screen flex-col min-[900px]:flex-row">
        <aside className="hidden w-64 shrink-0 border-r border-line bg-soft/60 px-4 py-5 min-[900px]:block">
          <Link href="/" className="mb-7 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-aqua text-white">
              <Droplets size={22} />
            </span>
            <span>
              <span className="block text-base font-semibold text-ink">Water Ops</span>
              <span className="block text-xs text-muted">операции и учет</span>
            </span>
          </Link>
          <Link
            href="/employee"
            className="mb-4 flex items-center gap-3 rounded-lg border border-aqua/30 bg-white px-3 py-3 text-sm font-semibold text-aqua shadow-sm"
          >
            <Smartphone size={18} />
            Мобильная форма
          </Link>
          <nav className="space-y-1">
            {sections.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition",
                  active === item.href
                    ? "bg-white text-aqua shadow-sm"
                    : "text-muted hover:bg-white hover:text-ink"
                )}
              >
                <item.icon size={17} />
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <header className="sticky top-0 z-30 border-b border-line bg-white/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] backdrop-blur min-[900px]:hidden">
          <div className="mb-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-semibold text-ink">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-aqua text-white">
                <Droplets size={20} />
              </span>
              Учет воды
            </Link>
            <Link href="/employee" className="rounded-md border border-line px-2 py-1 text-xs font-medium text-muted">
              Форма 19 л
            </Link>
          </div>
          <nav className="table-scroll flex gap-2 overflow-x-auto pb-1">
            {sections.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium",
                  active === item.href
                    ? "border-aqua bg-aqua text-white"
                    : "border-line bg-white text-muted"
                )}
              >
                <item.icon size={15} />
                {item.label}
              </Link>
            ))}
          </nav>
        </header>

        <main className="min-w-0 flex-1 pb-[calc(env(safe-area-inset-bottom)+84px)] min-[900px]:pb-0">{children}</main>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+6px)] pt-2 shadow-[0_-12px_30px_rgba(16,32,42,0.08)] backdrop-blur min-[900px]:hidden">
          <div className="grid grid-cols-5 gap-1">
            {mobileTabs.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium leading-none",
                  active === item.href
                    ? "bg-aqua text-white"
                    : "text-muted active:bg-soft"
                )}
              >
                <item.icon size={19} />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}

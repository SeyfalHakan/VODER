import { clsx } from "clsx";
import { AlertTriangle } from "lucide-react";
import { label } from "@/lib/format";

export function PageHeader({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-line bg-white px-4 py-4 sm:px-6 min-[900px]:flex-row min-[900px]:items-center min-[900px]:justify-between min-[900px]:py-5 lg:px-8">
      <div>
        <h1 className="text-xl font-semibold tracking-normal text-ink sm:text-3xl">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  title,
  value,
  helper,
  tone = "default"
}: {
  title: string;
  value: string | number;
  helper?: string;
  tone?: "default" | "good" | "warning" | "danger";
}) {
  return (
    <div
      className={clsx(
        "rounded-lg border bg-white p-3 shadow-soft sm:p-4",
        tone === "warning" ? "border-amber-200" : tone === "danger" ? "border-red-200" : "border-line"
      )}
    >
      <p className="text-xs font-medium uppercase text-muted">{title}</p>
      <p className="mt-2 break-words text-2xl font-semibold text-ink">{value}</p>
      {helper ? <p className="mt-1 text-xs leading-5 text-muted">{helper}</p> : null}
    </div>
  );
}

export function DataTable({
  title,
  columns,
  rows,
  empty = "Данных пока нет"
}: {
  title: string;
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
  empty?: string;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-line bg-white shadow-soft">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
      </div>
      <div className="hidden overflow-x-auto min-[1100px]:block">
        <table className="w-full min-w-[680px] border-collapse text-left text-sm">
          <thead className="bg-soft text-xs uppercase text-muted">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-3 font-semibold">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-5 text-muted" colSpan={columns.length}>
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={String(row.id ?? index)} className="border-t border-line">
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-3 text-ink">
                      {label(row[column.key], column.key)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-line min-[1100px]:hidden">
        {rows.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted">{empty}</p>
        ) : (
          rows.map((row, index) => (
            <article key={String(row.id ?? index)} className="px-4 py-3">
              <p className="mb-2 text-sm font-semibold text-ink">
                {label(row[columns[0]?.key], columns[0]?.key)}
              </p>
              <dl className="grid grid-cols-1 gap-2 text-sm">
                {columns.slice(1).map((column) => (
                  <div key={column.key} className="grid grid-cols-[minmax(90px,0.85fr)_minmax(0,1.15fr)] gap-3">
                    <dt className="text-muted">{column.label}</dt>
                    <dd className="min-w-0 break-words text-right font-medium text-ink">{label(row[column.key], column.key)}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

export function AlertList({ items }: { items: string[] }) {
  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="mb-3 flex items-center gap-2 text-warn">
        <AlertTriangle size={18} />
        <h2 className="text-base font-semibold">Расхождения и проверки</h2>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
            <p key={item} className="break-words rounded-md bg-white px-3 py-2 text-sm leading-6 text-ink">
            {item}
          </p>
        ))}
      </div>
    </section>
  );
}

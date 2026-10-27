import { Skeleton } from "@/components/ui/skeleton"

export default function EmailLoading() {
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-3 h-4 w-full max-w-xl" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-16 rounded-2xl" />
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
        <Skeleton className="h-5 w-56" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      </section>
    </div>
  )
}

import { Skeleton } from "@/components/ui/skeleton"

export default function NotificationsLoading() {
  return (
    <section className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm">
      <div className="space-y-3 border-b border-sky-100 px-5 py-5">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="space-y-4 px-5 py-5">
        <Skeleton className="h-9 w-full max-w-md" />
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex gap-3">
            <Skeleton className="size-8 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

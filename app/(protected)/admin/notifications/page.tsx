import {
  NotificationCentre,
  NotificationCentreError,
} from "@/components/notifications/notification-centre"
import { NotificationPreferences } from "@/components/notifications/notification-preferences"
import { getMyNotificationPreferences } from "@/lib/email/preferences"
import { getNotificationCentre } from "@/lib/notifications/store"

export const dynamic = "force-dynamic"

type NotificationsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function NotificationsPage({
  searchParams,
}: NotificationsPageProps) {
  const params = await searchParams
  const result = await getNotificationCentre({
    q: firstParam(params.q),
    bucket: firstParam(params.bucket),
    priority: firstParam(params.priority),
    sort: firstParam(params.sort),
    page: firstParam(params.page),
  })

  if (!result.ok) {
    return <NotificationCentreError message={result.message} />
  }

  const preferences = await getMyNotificationPreferences()

  return (
    <div className="flex flex-col gap-4">
      <NotificationCentre {...result.data} />
      {preferences ? <NotificationPreferences items={preferences} /> : null}
    </div>
  )
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

import { redirect } from "next/navigation"

import { EmailAdminPanel } from "@/components/email/email-admin-panel"
import { getEmailAdminData } from "@/lib/email/admin-data"
import { canAccess } from "@/lib/rbac"

export const dynamic = "force-dynamic"

type EmailPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function EmailPage({ searchParams }: EmailPageProps) {
  const canView = await canAccess("/admin/email", "view")
  if (!canView) redirect("/404")

  const params = await searchParams
  const data = await getEmailAdminData({
    status: firstParam(params.status),
    page: firstParam(params.page),
  })

  if (!data) redirect("/404")

  return <EmailAdminPanel data={data} />
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

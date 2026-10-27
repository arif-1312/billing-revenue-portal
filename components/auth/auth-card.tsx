import Image from "next/image"
import Link from "next/link"

import { getConfiguration } from "@/lib/actions/configuration"

export async function AuthCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  const configuration = await getConfiguration()
  const companyName = configuration?.name || "SY ASSOCIATES"
  const logo = configuration?.logo || "/sy.png"

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_32%),linear-gradient(135deg,#eff6ff_0%,#f8fafc_45%,#dbeafe_100%)] px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col justify-center">
        <div className="mb-6 flex items-center gap-3">
          <Image src={logo} alt="Logo" width={48} height={48} className="rounded-xl bg-white object-cover shadow-sm" />
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Billing Platform</p>
            <p className="text-lg font-semibold text-slate-900">{companyName}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] md:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
          <div className="mt-6">{children}</div>
          <Link href="/login" className="mt-6 inline-block text-sm font-medium text-[#1d4ed8] hover:text-[#1e40af]">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
}

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { IconUserCircle } from "@tabler/icons-react";

import { ProfileTabs } from "@/components/profile/profile-tabs";
import { getCurrentUserProfile } from "@/lib/actions/users";

export default async function ProfilePage() {
  await connection();
  const user = await getCurrentUserProfile();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.14),_transparent_28%),linear-gradient(135deg,_#ffffff,_#f8fbff_55%,_#eef5ff)] px-6 py-7 sm:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-sky-700">
                Account Center
              </p>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3 text-sky-700">
                  <IconUserCircle className="size-5" />
                </div>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                    My Profile
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600 sm:text-[15px]">
                    Review your account information and
                    update your password from one place.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ProfileTabs
        user={{
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          username: user.username || "",
          email: user.email || "",
        }}
      />
    </div>
  );
}

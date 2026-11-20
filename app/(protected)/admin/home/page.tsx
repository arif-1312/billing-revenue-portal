import HomePage from "@/components/home/home-page";
import { getConfiguration } from "@/lib/actions/configuration";
import { canAccess } from "@/lib/rbac";
import { LoginPoRenewalDialog } from "@/components/revenue-management/login-po-renewal-dialog";

export default async function Page({ searchParams }: PageProps<"/admin/home">) {
  const configuration = await getConfiguration();
  const params = await searchParams;
  const showPoRenewals = params.showPoRenewals === "1" && await canAccess("/admin/dashboard", "view");

  return (
    <>
    {showPoRenewals ? <LoginPoRenewalDialog /> : null}
    <HomePage
      configuration={
        configuration
          ? {
              name: configuration.name,
              logo: configuration.logo,
            }
          : undefined
      }
    />
    </>
  );
}

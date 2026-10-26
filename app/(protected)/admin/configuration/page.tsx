export const dynamic = "force-dynamic";

import ConfigurationForm from "./configuration-form";
import { getConfigurationSettings } from "@/lib/actions/configuration";
import { canAccess } from "@/lib/rbac";
import { redirect } from "next/navigation";

const ConfigurationPage = async () => {
    const canView = await canAccess("/admin/configuration", "view");

    if (!canView) {
        redirect("/404");
    }

    const configuration = await getConfigurationSettings();

    return (
        <ConfigurationForm
            data={
                configuration
                    ? {
                        id: configuration.id,
                        name: configuration.name || undefined,
                        logo: configuration.logo || undefined,
                        favicon: configuration.favicon || undefined,
                        email: configuration.email || undefined,
                        password: "",
                        passwordConfigured: configuration.passwordConfigured,
                    }
                    : undefined
            }
        />
    );
};

export default ConfigurationPage;
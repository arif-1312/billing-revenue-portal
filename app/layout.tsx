import type { Metadata } from "next";
import "./globals.css";
import { getConfiguration } from "@/lib/actions/configuration";
import { Providers } from "@/lib/providers";

const APP_NAME = "Billing and Revenue Portal";
const APP_DESCRIPTION = "Internal Billing Management System";
const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";

/* REMOVE export const metadata */

export async function generateMetadata(): Promise<Metadata> {
  try {
    const config = await getConfiguration();

    const appName = config?.name || APP_NAME;
    const favicon = config?.favicon || "/favicon.ico";

    return {
      title: {
        template: `%s | ${appName}`,
        default: appName,
      },
      description: APP_DESCRIPTION,
      metadataBase: new URL(SERVER_URL),
      icons: {
        icon: [
          { url: favicon },
          { url: favicon, rel: "shortcut icon" },
        ],
        apple: [{ url: favicon }],
      },
    };
  } catch {
    return {
      title: {
        template: `%s | ${APP_NAME}`,
        default: APP_NAME,
      },
      description: APP_DESCRIPTION,
      metadataBase: new URL(SERVER_URL),
      icons: {
        icon: "/favicon.ico",
      },
    };
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="min-h-screen bg-background text-foreground antialiased"
        style={
          {
            "--font-geist-sans":
              '"Segoe UI", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
            "--font-geist-mono":
              '"Cascadia Code", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
          } as React.CSSProperties
        }
      >
        <Providers>
          <div className="flex">
            <main className="flex-1">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}

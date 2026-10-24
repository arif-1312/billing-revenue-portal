"use server";

import { Configuration } from "@/types";
import { prisma } from "@/lib/prisma";
import { configurationSchema } from "../validators";
import { formatError } from "../utils";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { requirePermission } from "@/lib/rbac";
import { fingerprint } from "@/lib/notifications/model";
import { safePublishSystem } from "@/lib/notifications/publish";

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const ALLOWED_UPLOADS = new Map([
  [".png", new Set(["image/png"])],
  [".jpg", new Set(["image/jpeg"])],
  [".jpeg", new Set(["image/jpeg"])],
  [".webp", new Set(["image/webp"])],
  [".ico", new Set(["image/x-icon", "image/vnd.microsoft.icon"])],
]);

const publicConfigurationSelect = {
  name: true,
  logo: true,
  favicon: true,
} as const;

/* ================= GET CONFIGURATION ================= */
export async function getConfiguration() {
  try {
    const config = await prisma.configuration.findFirst({
      select: publicConfigurationSelect,
    });
    return config ?? null;
  } catch {
    console.error("Error fetching configuration");
    return null;
  }
}

export async function getConfigurationSettings() {
  const access = await requirePermission("/admin/configuration", "view");
  if (!access.ok) return null;

  try {
    return await prisma.configuration.findFirst({
      select: {
        id: true,
        name: true,
        logo: true,
        favicon: true,
        email: true,
        password: true,
      },
    });
  } catch {
    console.error("Error fetching configuration settings");
    return null;
  }
}

/* ================= SAVE FILE ================= */
async function saveUploadedFile(file: File) {
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Image must be 2 MB or smaller");
  }

  const extension = path.extname(file.name || "").toLowerCase();
  const allowedTypes = ALLOWED_UPLOADS.get(extension);

  if (!allowedTypes) {
    throw new Error("Upload a PNG, JPEG, WEBP, or ICO image");
  }

  const mime = file.type.toLowerCase();
  if (mime && !allowedTypes.has(mime)) {
    throw new Error("Upload a PNG, JPEG, WEBP, or ICO image");
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const fileName = `${randomUUID()}${extension}`;

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  const filePath = path.join(uploadDir, fileName);

  await mkdir(uploadDir, { recursive: true });
  await writeFile(filePath, buffer);

  return `/uploads/${fileName}`;
}

/* ================= SAVE FROM FORM ================= */
export async function saveConfigurationFromForm(formData: FormData) {
  try {
    const access = await requirePermission("/admin/configuration", "edit");
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    const existing = await prisma.configuration.findFirst();

    const logoInput = formData.get("logo");
    const faviconInput = formData.get("favicon");

    const existingLogo = String(formData.get("existingLogo") || "").trim();
    const existingFavicon = String(formData.get("existingFavicon") || "").trim();

    let logo: string | undefined = existingLogo || undefined;
    let favicon: string | undefined = existingFavicon || undefined;

    if (logoInput instanceof File && logoInput.size > 0) {
      logo = await saveUploadedFile(logoInput);
    }

    if (faviconInput instanceof File && faviconInput.size > 0) {
      favicon = await saveUploadedFile(faviconInput);
    }

    const payload: Configuration = {
      id: existing?.id,
      name: String(formData.get("name") || "").trim(),
      logo,
      favicon,
      email: String(formData.get("email") || "").trim(),
      password: String(formData.get("password") || "").trim(),
    };

    return await createOrUpdateConfiguration(payload);
  } catch (error) {
    console.error("Failed to save configuration");

    return {
      success: false,
      message: formatError(error),
    };
  }
}

/* ================= CREATE / UPDATE ================= */
export async function createOrUpdateConfiguration(data: Configuration) {
  try {
    const access = await requirePermission("/admin/configuration", "edit");
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    const configuration = configurationSchema.parse(data);

    const formattedData = {
      name: configuration.name || null,
      logo:
        typeof configuration.logo === "string"
          ? configuration.logo
          : null,
      favicon:
        typeof configuration.favicon === "string"
          ? configuration.favicon
          : null,
      email: configuration.email || null,
      password: configuration.password || null,
    };

    const existing = await prisma.configuration.findFirst();

    const saved = existing
      ? await prisma.configuration.update({
        where: { id: existing.id },
        data: formattedData,
      })
      : await prisma.configuration.create({
        data: formattedData,
      });

    await safePublishSystem({
      eventType: "SYSTEM_UPDATE",
      entityType: "Configuration",
      entityId: saved.id,
      title: "Portal settings updated",
      body: "Organisation name or branding settings were changed.",
      href: "/admin/configuration",
      fingerprint: fingerprint([
        formattedData.name,
        formattedData.logo,
        formattedData.favicon,
      ]),
    });

    return {
      success: true,
      message: "Configuration saved successfully",
    };
  } catch (error) {
    console.error("Failed to save configuration");

    return {
      success: false,
      message: formatError(error),
    };
  }
}

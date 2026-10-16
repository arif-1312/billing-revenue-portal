import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type ZodIssueLike = {
  message?: string
}

type ErrorWithDetails = {
  name?: string
  message?: unknown
  code?: string
  meta?: { target?: string[] }
  issues?: ZodIssueLike[]
  errors?: ZodIssueLike[]
}

const GENERIC_ERROR = "Something went wrong"

function exposesInternalDetail(message: string) {
  return /prisma|postgres:\/\/|ECONN|ENOTFOUND|password authentication failed|invocation in|Invalid `prisma|getaddrinfo|DATABASE_URL/i.test(
    message,
  )
}

export function formatError(error: unknown) {
  try {
    const parsedError = error as ErrorWithDetails

    if (!parsedError || typeof parsedError !== "object") {
      return GENERIC_ERROR
    }

    if (parsedError.name === "ZodError") {
      const issues = Array.isArray(parsedError.issues)
        ? parsedError.issues
        : Array.isArray(parsedError.errors)
          ? parsedError.errors
          : [];
      const filterErrors = issues
        .map((issue) => issue.message)
        .filter((message): message is string => typeof message === "string" && !exposesInternalDetail(message));

      return filterErrors.join(". ") || GENERIC_ERROR
    }

    if (typeof parsedError.name === "string" && parsedError.name.startsWith("Prisma")) {
      if (parsedError.name === "PrismaClientKnownRequestError" && parsedError.code === "P2002") {
        const rawField = parsedError.meta?.target?.[0]
        const field =
          typeof rawField === "string" && /^[A-Za-z][A-Za-z0-9_]*$/.test(rawField)
            ? rawField
            : "Field"
        return `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
      }

      return GENERIC_ERROR
    }

    if (typeof parsedError.message === "string") {
      if (!parsedError.message || exposesInternalDetail(parsedError.message)) {
        return GENERIC_ERROR
      }

      return parsedError.message
    }

    return GENERIC_ERROR
  } catch {
    return GENERIC_ERROR
  }
}

export function incrementCode(value: number | string, length: number = 6): string {
  const number = typeof value === "string"
    ? parseInt(value, 10) + 1
    : value

  return number.toString().padStart(length, "0")
}

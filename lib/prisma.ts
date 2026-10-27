import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { assertSafeDatabaseTarget, databasePoolOptions } from "./database-guard"
import {
  auditQuery,
  bindAuditReader,
  flushAuditEvents,
  registerFinancialTransaction,
  runInAuditBuffer,
} from "./audit"
import type { PrismaClient as PrismaClientType } from "@prisma/client"

assertSafeDatabaseTarget(process.env.DATABASE_URL)

function createPrismaClient() {
  const pool = new Pool(
    databasePoolOptions(process.env.DATABASE_URL as string),
  )

  const adapter = new PrismaPg(pool)
  const base = new PrismaClient({
    adapter,
    log: ["error"],
  })

  const extended = base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          return auditQuery({
            base,
            model,
            operation,
            args,
            query,
          })
        },
      },
    },
  })

  const proxied = new Proxy(extended, {
    get(target, property, receiver) {
      if (property === "$transaction") {
        const original = target.$transaction

        return (first: unknown, ...rest: unknown[]) =>
          runInAuditBuffer(base, () => {
            if (typeof first !== "function") {
              return original.call(target, first as never, ...(rest as never[]))
            }

            const run = first as (tx: PrismaClientType) => Promise<unknown>

            return original.call(
              target,
              (async (tx: PrismaClientType) => {
                bindAuditReader(tx)
                try {
                  const result = await run(tx)
                  await flushAuditEvents(tx)
                  return result
                } finally {
                  bindAuditReader(null)
                }
              }) as never,
              ...(rest as never[]),
            )
          })
      }

      return Reflect.get(target, property, receiver)
    },
  }) as typeof extended

  registerFinancialTransaction((fn) => {
    const run = proxied.$transaction as unknown as (
      callback: typeof fn,
    ) => ReturnType<typeof fn>
    return run(fn)
  })

  return proxied
}

type AppPrisma = ReturnType<typeof createPrismaClient>

const globalForPrisma = global as unknown as {
  billingPrisma?: AppPrisma
}

const client = globalForPrisma.billingPrisma ?? createPrismaClient()

// Keep the public type as PrismaClient so transaction callbacks stay compatible
// with existing actions. The runtime client is still the auditing proxy.
export const prisma = client as unknown as PrismaClient

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.billingPrisma = client
}

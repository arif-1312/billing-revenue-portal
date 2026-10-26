import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./lib/prisma"
import CredentialsProvider from "next-auth/providers/credentials"
import { authorizeCredentials } from "./lib/credentials"
import { readSessionDecision } from "./lib/session-revocation"
import { IDLE_TIMEOUT_MS, idleExpired } from "./lib/session-decision"

const TWELVE_HOURS = 12 * 60 * 60
const secureCookies = process.env.NODE_ENV === "production"

export const { handlers, signIn, signOut, auth } = NextAuth({
    secret: process.env.AUTH_SECRET,
    pages: {
        signIn: "/",
        error: "/"
    },
    session: {
        strategy: "jwt" as const,
        maxAge: TWELVE_HOURS,
    },
    cookies: {
        sessionToken: {
            name: secureCookies
                ? "__Secure-authjs.session-token"
                : "authjs.session-token",
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: secureCookies,
            },
        },
    },
    adapter: PrismaAdapter(prisma) as any,
    providers: [
        CredentialsProvider({
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials, request) {
                const forwarded = request?.headers?.get("x-forwarded-for")
                const ip = forwarded?.split(",")[0]?.trim() || "unknown"
                return authorizeCredentials(credentials, ip)
            }
        })
    ],
    callbacks: {
        async session({ session, token }: any) {
            if (token.invalid) {
                session.user = undefined
                return session
            }

            session.user.id = token.id || token.sub
            session.user.role = token.role || ""
            session.user.firstName = token.firstName || ""
            session.user.username = token.username || ""
            session.user.name = token.firstName || session.user.name
            session.user.email = token.email || session.user.email

            return session
        },
        async jwt({ token, user }: any) {
            if (user) {
                token.id = user.id
                token.role = user.role
                token.firstName = user.firstName
                token.email = user.email
                token.username = user.username
                token.credentialVersion = user.credentialVersion
                token.lastActive = Date.now()
                token.invalid = false
                return token
            }

            if (idleExpired(token.lastActive, Date.now(), IDLE_TIMEOUT_MS)) {
                token.invalid = true
                return token
            }
            token.lastActive = Date.now()

            const issuedAt = Number(token.iat)
            const userId = token.id || token.sub
            if (!userId || !Number.isFinite(issuedAt)) {
                token.invalid = true
                return token
            }

            try {
                const decision = await readSessionDecision({
                    userId: String(userId),
                    issuedAt: new Date(issuedAt * 1000),
                    tokenFingerprint:
                        typeof token.credentialVersion === "string"
                            ? token.credentialVersion
                            : undefined,
                })
                token.invalid = decision !== "valid"
            } catch {
                token.invalid = true
            }

            return token
        }
    }
})

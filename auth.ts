import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { authorizeCredentials } from "./lib/credentials"
import { clientAddress } from "./lib/client-address"
import { readSessionDecision } from "./lib/session-revocation"
import { IDLE_TIMEOUT_MS, idleExpired } from "./lib/session-decision"

const TWELVE_HOURS = 12 * 60 * 60
const secureCookies = process.env.NODE_ENV === "production"

function text(value: unknown) {
    return typeof value === "string" ? value : ""
}

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
    providers: [
        CredentialsProvider({
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials, request) {
                const ip = clientAddress(request?.headers)
                return authorizeCredentials(credentials, ip)
            }
        })
    ],
    callbacks: {
        async session({ session, token }) {
            if (token.invalid) {
                session.user = undefined as unknown as typeof session.user
                return session
            }

            session.user.id = text(token.id) || text(token.sub)
            session.user.role = text(token.role)
            session.user.firstName = text(token.firstName)
            session.user.username = text(token.username)
            session.user.name = text(token.firstName) || session.user.name
            session.user.email = typeof token.email === "string" ? token.email : session.user.email

            return session
        },
        async jwt({ token, user }) {
            if (user) {
                token.id = text(user.id)
                token.role = text(user.role)
                token.firstName = text(user.firstName)
                token.email = typeof user.email === "string" ? user.email : null
                token.username = text(user.username)
                token.credentialVersion = text(user.credentialVersion)
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

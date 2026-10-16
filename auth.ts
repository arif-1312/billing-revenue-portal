import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./lib/prisma"
import CredentialsProvider from "next-auth/providers/credentials"
import { authorizeCredentials } from "./lib/credentials"

const TWELVE_HOURS = 12 * 60 * 60

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
    adapter: PrismaAdapter(prisma) as any,
    providers: [
        CredentialsProvider({
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                return authorizeCredentials(credentials)
            }
        })
    ],
    callbacks: {
        async session({ session, token }: any) {
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
            }

            return token
        }
    }
})

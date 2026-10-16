import NextAuth from "next-auth"

declare module "next-auth" {
  interface User {
    id: string
    username: string
    role: string
    firstName: string
    lastName: string
    email?: string | null
  }

  interface Session {
    user: {
      id: string
      username: string
      role: string
      firstName: string
      lastName: string
      email?: string | null
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    username: string
    role: string
    firstName: string
    lastName: string
    email?: string | null
  }
}
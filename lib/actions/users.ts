"use server";

import { User } from "@/types";
import { prisma } from "../prisma";
import {
  changePasswordSchema,
  createUserSchema,
  loginFormSchema,
  updateCurrentUserProfileSchema,
  userSchema,
} from "../validators";
import { formatError } from "../utils";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { auth, signIn, signOut } from "@/auth";
import bcrypt from "bcrypt";
import { requirePermission } from "@/lib/rbac";
import { recordSecurityEvent } from "@/lib/security-event";

const userPublicSelect = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  email: true,
  status: true,
  remark: true,
  roleId: true,
  createdAt: true,
  updatedAt: true,
} as const;

type AuthenticatedSession = {
  user?: {
    id?: string | null;
    email?: string | null;
  } | null;
} | null;

function normalizeUserPayload(user: User) {
  const username = user.username?.trim();
  const firstName = user.firstName?.trim();
  const email = user.email?.trim();
  const roleId = user.roleId?.trim();

  if (!username) {
    throw new Error("Username is required");
  }

  if (!firstName) {
    throw new Error("First name is required");
  }

  if (!email) {
    throw new Error("Email is required");
  }

  if (!roleId) {
    throw new Error("Role is required");
  }

  return {
    username,
    firstName,
    lastName: user.lastName?.trim() || "",
    email,
    status: user.status ?? "ACTIVE",
    roleId,
    remark: user.remark?.trim() || null,
  } as const;
}

async function getAuthenticatedUserIdentity() {
  const session = (await auth()) as AuthenticatedSession;
  const userId = session?.user?.id;
  const email = session?.user?.email;

  if (!userId && !email) {
    return null;
  }

  const user = await prisma.user.findFirst({
    where: userId ? { id: userId } : { email: email as string },
    select: { id: true, email: true, status: true },
  });

  if (!user || user.status !== "ACTIVE") {
    return null;
  }

  return {
    userId: user.id,
    email: user.email,
  };
}

export async function getUsers() {
  const access = await requirePermission("/admin/users", "view");
  if (!access.ok) return [];

  return await prisma.user.findMany({
    orderBy: {
      createdAt: 'desc'
    },
    select: {
      ...userPublicSelect,
      role: true,
    },
  })
}

export async function createUser(data: User) {

  try {
    const access = await requirePermission("/admin/users", "create");
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    const user = createUserSchema.parse(data)
    const password = user.password?.trim();

    if (!password) {
      throw new Error("Password is required");
    }
    const payload = normalizeUserPayload(user);

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        ...payload,
        password: hashedPassword,
      }
    })

    return {
      success: true,
      message: "User created successfully"
    }

  } catch (error) {
    return {
      success: false,
      message: formatError(error)
    }
  }
}
export async function getUserById(id: string) {
  try {
    const access = await requirePermission("/admin/users", "view", [
      { route: "/admin/users", action: "edit" },
    ]);
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    const user = await prisma.user.findFirst({
      where: { id },
      select: userPublicSelect,
    })

    if (user) {
      return {
        success: true,
        data: user,
        message: "User fetched successfully"
      }
    }

    return {
      success: false,
      message: "User not found"
    }

  } catch (error) {
    return {
      success: false,
      message: formatError(error)
    }
  }
}


export async function updateUser(data: User, id: string) {
  try {
    const access = await requirePermission("/admin/users", "edit");
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    const user = userSchema.parse(data)
    const payload = normalizeUserPayload(user)

    await prisma.user.update({
      where: { id },
      data: payload
    })

    return {
      success: true,
      message: "User updated successfully"
    }

  } catch (error) {
    return {
      success: false,
      message: formatError(error)
    }
  }
}

export async function deleteUser(id: string) {
  try {
    const access = await requirePermission("/admin/users", "delete");
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    await prisma.user.delete({
      where: { id }
    })

    return {
      success: true,
      message: "User deleted successfully"
    }

  } catch (error) {
    return {
      success: false,
      message: formatError(error)
    }
  }
}

export async function loginFormUser(prevState: unknown, formData: FormData) {
  const result = loginFormSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  // Validation failed
  if (!result.success) {
    return {
      success: false,
      message: result.error.issues[0].message,
    };
  }

  const user = result.data;

  try {
    await signIn("credentials", user);

    return {
      success: true,
      message: "Login successfully",
    };
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    return {
      success: false,
      message: "Invalid username or password",
    };
  }
}

// logout user
export async function logoutUser() {
  try {
    const identity = await getAuthenticatedUserIdentity().catch(() => null);
    await recordSecurityEvent({
      event: "LOGOUT",
      username: identity?.email ?? null,
      userId: identity?.userId ?? null,
      result: "success",
    });
    await signOut()
    return {
      success: true,
      message: "logout successfully"
    }
  } catch (error) {
    if (isRedirectError(error)) {
      throw error
    }

    return {
      success: false,
      message: "Something went wrong"
    }
  }
}


export async function getCurrentUser() {
  try {
    const identity = await getAuthenticatedUserIdentity();

    if (identity?.userId) {
      const user = await prisma.user.findUnique({
        where: { id: identity.userId },
        select: userPublicSelect,
      });

      if (!user) return null;

      return {
        success: true,
        data: user,
        message: "User fetched successfully",
      };
    }

    return null;
  } catch (err) {
    console.error("Failed to get current user:", err);
    return null; 
  }
}

export async function getCurrentUserProfile() {
  try {
    const identity = await getAuthenticatedUserIdentity();
    const userId = identity?.userId;

    if (!userId) {
      return null;
    }

    return await prisma.user.findUnique({
      where: { id: userId as string },
      select: {
        ...userPublicSelect,
        role: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });
  } catch (err) {
    console.error("Failed to get current user profile:", err);
    return null;
  }
}

export async function changeCurrentUserPassword(payload: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  try {
    const identity = await getAuthenticatedUserIdentity();
    const userId = identity?.userId;

    if (!userId) {
      return {
        success: false,
        message: "You must be logged in to change your password",
      };
    }

    const validated = changePasswordSchema.parse(payload);

    const user = await prisma.user.findUnique({
      where: { id: userId as string },
      select: {
        id: true,
        password: true,
        status: true,
      },
    });

    if (!user?.password || user.status !== "ACTIVE") {
      return {
        success: false,
        message: "You must be logged in to change your password",
      };
    }

    const isMatched = await bcrypt.compare(
      validated.currentPassword,
      user.password,
    );

    if (!isMatched) {
      return {
        success: false,
        message: "Current password is incorrect",
      };
    }

    const isSamePassword = await bcrypt.compare(
      validated.newPassword,
      user.password,
    );

    if (isSamePassword) {
      return {
        success: false,
        message: "New password must be different from the current password",
      };
    }

    const hashedPassword = await bcrypt.hash(
      validated.newPassword,
      10,
    );

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
      },
    });

    return {
      success: true,
      message: "Password updated successfully",
    };
  } catch (error) {
    return {
      success: false,
      message: formatError(error),
    };
  }
}

export async function updateCurrentUserProfile(payload: {
  firstName: string;
  lastName?: string;
}) {
  try {
    const identity = await getAuthenticatedUserIdentity();
    const userId = identity?.userId;

    if (!userId) {
      return {
        success: false,
        message: "You must be logged in to update your profile",
      };
    }

    const validated =
      updateCurrentUserProfileSchema.parse(payload);

    await prisma.user.update({
      where: { id: userId as string },
      data: {
        firstName: validated.firstName,
        lastName: validated.lastName?.trim() || "",
      },
    });

    return {
      success: true,
      message: "Profile updated successfully",
    };
  } catch (error) {
    return {
      success: false,
      message: formatError(error),
    };
  }
}

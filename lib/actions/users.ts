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
import bcrypt from "bcrypt"
import { hashPassword } from "@/lib/password";
import { notifyPasswordChanged } from "@/lib/password-reset-service";
import { getUserPermissions, requirePermission } from "@/lib/rbac";
import { recordSecurityEvent } from "@/lib/security-event";
import {
  canRemoveSystemUser,
  roleAssignmentDecision,
  rolePermissionsExceed,
  type PermissionFlags,
} from "@/lib/privilege";
import { fingerprint } from "@/lib/notifications/model";
import { safePublishSystem } from "@/lib/notifications/publish";

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

function userActivityCopy(input: {
  name: string
  email: string
  previousStatus: string
  previousRoleId: string
  previousRoleName: string
  nextStatus: string
  nextRoleId: string
  nextRoleName: string
}) {
  const statusChanged = input.previousStatus !== input.nextStatus
  const roleChanged = input.previousRoleId !== input.nextRoleId
  const priority =
    (statusChanged && input.nextStatus === "INACTIVE") || roleChanged
      ? "HIGH" as const
      : "NORMAL" as const

  if (statusChanged && !roleChanged && input.nextStatus === "ACTIVE") {
    return {
      title: "User account activated",
      body: `${input.name} (${input.email}) was activated.`,
      priority,
    }
  }

  if (statusChanged && !roleChanged && input.nextStatus === "INACTIVE") {
    return {
      title: "User account deactivated",
      body: `${input.name} (${input.email}) was deactivated.`,
      priority,
    }
  }

  if (roleChanged && !statusChanged) {
    return {
      title: "User role changed",
      body: `${input.name} (${input.email}) moved from ${input.previousRoleName} to ${input.nextRoleName}.`,
      priority,
    }
  }

  const parts: string[] = []
  if (statusChanged) {
    parts.push(`status is ${input.nextStatus === "ACTIVE" ? "active" : "inactive"}`)
  }
  if (roleChanged) parts.push(`role is ${input.nextRoleName}`)

  return {
    title: "User account updated",
    body: parts.length
      ? `${input.name} (${input.email}) was updated. ${parts.join("; ")}.`
      : `${input.name} (${input.email}) was updated.`,
    priority,
  }
}

function grantMap(role: {
  status?: string | null;
  roleModules?: Array<{
    moduleId: string;
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    module?: { status?: string | null } | null;
  }>;
} | null | undefined) {
  const grants = new Map<string, PermissionFlags>();
  if (!role || role.status !== "ACTIVE") return grants;

  for (const roleModule of role.roleModules ?? []) {
    if (roleModule.module && roleModule.module.status !== "ACTIVE") continue;
    grants.set(roleModule.moduleId, {
      canView: roleModule.canView,
      canCreate: roleModule.canCreate,
      canEdit: roleModule.canEdit,
      canDelete: roleModule.canDelete,
    });
  }

  return grants;
}

async function assertRoleAssignment(input: {
  targetUserId?: string;
  roleId: string;
  nextStatus?: string | null;
}) {
  const actor = await getUserPermissions();
  if (!actor?.id) {
    return { ok: false as const, message: "Unauthorized" };
  }

  const nextRole = await prisma.role.findUnique({
    where: { id: input.roleId },
    include: {
      roleModules: {
        include: { module: { select: { status: true } } },
      },
    },
  });

  if (!nextRole) {
    return { ok: false as const, message: "Role not found" };
  }

  const target = input.targetUserId
    ? await prisma.user.findUnique({
        where: { id: input.targetUserId },
        include: { role: { select: { isSystem: true, status: true } } },
      })
    : null;

  if (input.targetUserId && !target) {
    return { ok: false as const, message: "User not found" };
  }

  const otherActiveSystemUsers = await prisma.user.count({
    where: {
      ...(input.targetUserId ? { id: { not: input.targetUserId } } : {}),
      status: "ACTIVE",
      role: { isSystem: true, status: "ACTIVE" },
    },
  });

  const targetIsActiveSystem = Boolean(
    target &&
      target.status === "ACTIVE" &&
      target.role.isSystem &&
      target.role.status === "ACTIVE",
  );

  return roleAssignmentDecision({
    actorIsSystem: Boolean(actor.role?.isSystem && actor.role.status === "ACTIVE"),
    targetIsActiveSystem,
    nextRoleIsSystem: nextRole.isSystem,
    nextRoleIsActive: nextRole.status === "ACTIVE",
    nextRoleExceedsActor: rolePermissionsExceed(
      grantMap(actor.role),
      grantMap(nextRole),
    ),
    otherActiveSystemUsers,
    deactivatesTarget: input.nextStatus === "INACTIVE",
  });
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
    const assignment = await assertRoleAssignment({
      roleId: payload.roleId,
      nextStatus: payload.status,
    });
    if (!assignment.ok) {
      return { success: false, message: assignment.message };
    }

    const hashedPassword = await hashPassword(password);

    const created = await prisma.user.create({
      data: {
        ...payload,
        password: hashedPassword,
      },
      select: { id: true },
    })

    const name = [payload.firstName, payload.lastName].filter(Boolean).join(" ")
    await safePublishSystem({
      eventType: "SYSTEM_USER_ACTIVITY",
      entityType: "User",
      entityId: created.id,
      title: "User account created",
      body: `${name} (${payload.email}) was added as a user.`,
      href: "/admin/users",
      fingerprint: fingerprint(["created", payload.email, payload.roleId]),
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
    const assignment = await assertRoleAssignment({
      targetUserId: id,
      roleId: payload.roleId,
      nextStatus: payload.status,
    });
    if (!assignment.ok) {
      await recordSecurityEvent({
        event: "PRIVILEGE_CHANGE",
        result: "failure",
        route: "/admin/users",
        action: "edit",
      });
      return { success: false, message: assignment.message };
    }

    const previous = await prisma.user.findUnique({
      where: { id },
      select: {
        status: true,
        roleId: true,
        role: { select: { name: true } },
      },
    })
    if (!previous) {
      return { success: false, message: "User not found" }
    }

    const nextRole = await prisma.role.findUnique({
      where: { id: payload.roleId },
      select: { name: true },
    })

    await prisma.user.update({
      where: { id },
      data: payload
    })

    const name = [payload.firstName, payload.lastName].filter(Boolean).join(" ")
    const activity = userActivityCopy({
      name,
      email: payload.email,
      previousStatus: previous.status,
      previousRoleId: previous.roleId,
      previousRoleName: previous.role.name,
      nextStatus: payload.status,
      nextRoleId: payload.roleId,
      nextRoleName: nextRole?.name || "another role",
    })
    await safePublishSystem({
      eventType: "SYSTEM_USER_ACTIVITY",
      entityType: "User",
      entityId: id,
      title: activity.title,
      body: activity.body,
      href: "/admin/users",
      priority: activity.priority,
      fingerprint: fingerprint([
        "updated",
        payload.username,
        payload.email,
        payload.firstName,
        payload.lastName,
        payload.status,
        payload.roleId,
      ]),
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

    const existing = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
        role: { select: { isSystem: true, status: true } },
      },
    })
    const otherActiveSystemUsers = await prisma.user.count({
      where: {
        id: { not: id },
        status: "ACTIVE",
        role: { isSystem: true, status: "ACTIVE" },
      },
    })
    const removal = canRemoveSystemUser({
      targetIsActiveSystem: Boolean(
        existing &&
          existing.status === "ACTIVE" &&
          existing.role.isSystem &&
          existing.role.status === "ACTIVE",
      ),
      otherActiveSystemUsers,
    })
    if (!removal.ok) {
      await recordSecurityEvent({
        event: "PRIVILEGE_CHANGE",
        result: "failure",
        route: "/admin/users",
        action: "delete",
      })
      return { success: false, message: removal.message }
    }

    await prisma.user.delete({
      where: { id }
    })

    if (existing) {
      const name = [existing.firstName, existing.lastName].filter(Boolean).join(" ")
      await safePublishSystem({
        eventType: "SYSTEM_USER_ACTIVITY",
        entityType: "User",
        entityId: existing.id,
        title: "User account removed",
        body: `${name} (${existing.email}) was removed.`,
        href: "/admin/users",
        fingerprint: "deleted",
        priority: "HIGH",
      })
    }

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

    const hashedPassword = await hashPassword(
      validated.newPassword,
    );

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
      },
    });

    await notifyPasswordChanged(user.id);

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

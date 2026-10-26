export type PermissionFlags = {
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
}

export type RequestedModuleGrant = {
  moduleId: string
  canView?: boolean
  canCreate?: boolean
  canEdit?: boolean
  canDelete?: boolean
}

const ACTIONS = ["canView", "canCreate", "canEdit", "canDelete"] as const

const emptyFlags = (): PermissionFlags => ({
  canView: false,
  canCreate: false,
  canEdit: false,
  canDelete: false,
})

export function unauthorizedGrant(
  actorGrants: ReadonlyMap<string, PermissionFlags>,
  requested: RequestedModuleGrant[],
) {
  for (const moduleGrant of requested) {
    const held = actorGrants.get(moduleGrant.moduleId) ?? emptyFlags()

    for (const action of ACTIONS) {
      if (moduleGrant[action] && !held[action]) {
        return moduleGrant
      }
    }
  }

  return null
}

export function rolePermissionsExceed(
  actorGrants: ReadonlyMap<string, PermissionFlags>,
  roleGrants: ReadonlyMap<string, PermissionFlags>,
) {
  for (const [moduleId, flags] of roleGrants) {
    if (unauthorizedGrant(actorGrants, [{ moduleId, ...flags }])) {
      return true
    }
  }

  return false
}

export function roleChangeDecision(input: {
  actorIsSystem: boolean
  targetIsSystem: boolean
  nextStatus: "ACTIVE" | "INACTIVE"
  renamesRole: boolean
  grantsExceedActor: boolean
}) {
  if (input.targetIsSystem && !input.actorIsSystem) {
    return {
      ok: false as const,
      message: "The system administrator role cannot be changed.",
    }
  }

  if (input.targetIsSystem && input.renamesRole) {
    return {
      ok: false as const,
      message: "The system administrator role cannot be renamed.",
    }
  }

  if (input.targetIsSystem && input.nextStatus !== "ACTIVE") {
    return {
      ok: false as const,
      message: "The system administrator role cannot be disabled.",
    }
  }

  if (input.grantsExceedActor) {
    return {
      ok: false as const,
      message: "You cannot grant a permission you do not have.",
    }
  }

  return { ok: true as const }
}

export function roleAssignmentDecision(input: {
  actorIsSystem: boolean
  targetIsActiveSystem: boolean
  nextRoleIsSystem: boolean
  nextRoleIsActive: boolean
  nextRoleExceedsActor: boolean
  otherActiveSystemUsers: number
  deactivatesTarget: boolean
}) {
  if (!input.nextRoleIsActive) {
    return {
      ok: false as const,
      message: "That role is disabled.",
    }
  }

  if (input.nextRoleIsSystem && !input.actorIsSystem) {
    return {
      ok: false as const,
      message: "You cannot assign the system administrator role.",
    }
  }

  if (input.nextRoleExceedsActor && !input.actorIsSystem) {
    return {
      ok: false as const,
      message: "You cannot assign a role with permissions you do not have.",
    }
  }

  const removesLastSystemUser =
    input.targetIsActiveSystem &&
    input.otherActiveSystemUsers < 1 &&
    (!input.nextRoleIsSystem || input.deactivatesTarget)

  if (removesLastSystemUser) {
    return {
      ok: false as const,
      message: "The last active system administrator cannot be removed or demoted.",
    }
  }

  return { ok: true as const }
}

export function canRemoveSystemUser(input: {
  targetIsActiveSystem: boolean
  otherActiveSystemUsers: number
}) {
  if (input.targetIsActiveSystem && input.otherActiveSystemUsers < 1) {
    return {
      ok: false as const,
      message: "The last active system administrator cannot be removed or demoted.",
    }
  }

  return { ok: true as const }
}

export function companyWithSharedDefaults(companyId: string) {
  return {
    OR: [{ companyId }, { companyId: null }],
  };
}

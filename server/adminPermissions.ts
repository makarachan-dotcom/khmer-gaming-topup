export const delegatedAdminPermissionKeys = [
  "dashboard",
  "orders",
  "catalog",
  "media",
  "support",
  "marketplace",
  "payments",
] as const;

export type DelegatedAdminPermission = (typeof delegatedAdminPermissionKeys)[number];

const permissionSet = new Set<string>(delegatedAdminPermissionKeys);

export function normalizeDelegatedAdminPermissions(value: unknown): DelegatedAdminPermission[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is DelegatedAdminPermission => typeof item === "string" && permissionSet.has(item))));
}

export function hasDelegatedAdminPermission(granted: readonly DelegatedAdminPermission[], required: DelegatedAdminPermission) {
  return granted.includes(required);
}

export const delegatedAdminPermissionLabels: Record<DelegatedAdminPermission, { labelKh: string; descriptionKh: string }> = {
  dashboard: { labelKh: "ផ្ទាំងសង្ខេប", descriptionKh: "មើលទិន្នន័យសង្ខេបហាង" },
  orders: { labelKh: "ការកម្មង់", descriptionKh: "មើល និងគ្រប់គ្រងស្ថានភាព order" },
  catalog: { labelKh: "កាតាឡុក និងតម្លៃ", descriptionKh: "គ្រប់គ្រង package, catalog និង margin" },
  media: { labelKh: "រូបភាព និងមាតិកា", descriptionKh: "កែ Banner, Game image និង Package artwork" },
  support: { labelKh: "Support", descriptionKh: "គ្រប់គ្រង ticket និង Contact Admin" },
  marketplace: { labelKh: "Marketplace", descriptionKh: "ពិនិត្យ listing, verification និង fraud reports" },
  payments: { labelKh: "Payment history", descriptionKh: "មើល payment transactions តែប៉ុណ្ណោះ" },
};

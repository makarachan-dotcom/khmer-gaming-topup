import { isSingleAdminEmail } from "./storefrontDomain";

export function validateAdminRoleChange(input: { targetEmail: string | null; previousRole: "user" | "admin"; nextRole: "user" | "admin"; confirmationEmail: string; reason: string }) {
  const targetEmail = input.targetEmail?.trim().toLowerCase() ?? "";
  if (!targetEmail || targetEmail !== input.confirmationEmail.trim().toLowerCase()) throw new Error("Confirm the target account email before changing permissions.");
  if (input.reason.trim().length < 10) throw new Error("Provide an audit reason of at least 10 characters.");
  if (input.previousRole === input.nextRole) throw new Error("This account already has that role.");
  if (isSingleAdminEmail(targetEmail) && input.nextRole !== "admin") throw new Error("The designated owner administrator cannot be demoted.");
}

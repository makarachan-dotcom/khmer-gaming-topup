import type { MascotState } from "@/components/ZursLoginMascot";

export type LoginPhase = "email" | "otp" | "name" | "verifying" | "success" | "blocked";

export function loginMascotState(input: {
  phase: LoginPhase;
  error: string | null;
  busy: boolean;
  watching: boolean;
  hasInput: boolean;
}): MascotState {
  if (input.phase === "blocked") return "banned";
  if (input.phase === "success") return "success";
  if (input.error) return "wrong";
  if (input.busy || input.phase === "verifying" || input.phase === "otp") return "peeking";
  if (input.watching || (input.phase === "email" && input.hasInput) || (input.phase === "name" && input.hasInput)) return "peeking";
  return "idle";
}

function errorBlob(reason: unknown) {
  if (reason instanceof Error) {
    const extra = reason as Error & { code?: number; type?: string };
    return `${extra.code ?? ""} ${extra.type ?? ""} ${reason.message}`.toLowerCase();
  }
  if (reason && typeof reason === "object") {
    const extra = reason as { code?: number; type?: string; message?: string };
    return `${extra.code ?? ""} ${extra.type ?? ""} ${extra.message ?? ""}`.toLowerCase();
  }
  return String(reason ?? "").toLowerCase();
}

export function loginErrorKh(reason: unknown, kind: "send" | "verify"): string {
  const blob = errorBlob(reason);
  const message = reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "";
  if (/[\u1780-\u17FF]/.test(message)) return message;
  if (/\b429\b|rate.?limit|too many/.test(blob)) {
    return kind === "verify" ? "ព្យាយាមញាប់ពេក។ សូមរង់ចាំបន្តិច។" : "ស្នើកូដញិកញាប់ពេក។ សូមរង់ចាំបន្តិច រួចព្យាយាមម្ដងទៀត។";
  }
  if (/expired|user_token_expired|token_expired/.test(blob)) return "លេខកូដផុតកំណត់ សូមផ្ញើឡើងវិញ";
  if (/invalid token|invalid credentials|user_invalid_token|invalid_code|incorrect/.test(blob)) {
    return "លេខកូដមិនត្រឹមត្រូវ សូមព្យាយាមម្តងទៀត";
  }
  if (/network|failed to fetch|load failed|timeout|offline|networkerror/.test(blob)) {
    return "បណ្តាញមានបញ្ហា សូមព្យាយាមម្តងទៀត";
  }
  if (kind === "verify") return "លេខកូដមិនត្រឹមត្រូវ សូមព្យាយាមម្តងទៀត";
  return "មិនអាចផ្ញើលេខកូដបានទេ។ សូមព្យាយាមម្ដងទៀត។";
}

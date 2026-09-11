import { describe, expect, it } from "vitest";
import { loginErrorKh, loginMascotState } from "./loginUi";

describe("login mascot state", () => {
  it("peeks while the email field is focused or filled", () => {
    expect(loginMascotState({ phase: "email", error: null, busy: false, watching: true, hasInput: false })).toBe("peeking");
    expect(loginMascotState({ phase: "email", error: null, busy: false, watching: false, hasInput: true })).toBe("peeking");
  });

  it("peeks while a request is in flight and on the OTP step", () => {
    expect(loginMascotState({ phase: "email", error: null, busy: true, watching: false, hasInput: false })).toBe("peeking");
    expect(loginMascotState({ phase: "verifying", error: null, busy: true, watching: false, hasInput: false })).toBe("peeking");
    expect(loginMascotState({ phase: "otp", error: null, busy: false, watching: false, hasInput: false })).toBe("peeking");
  });

  it("uses wrong, success, and banned over typing", () => {
    expect(loginMascotState({ phase: "otp", error: "bad", busy: false, watching: true, hasInput: true })).toBe("wrong");
    expect(loginMascotState({ phase: "success", error: null, busy: false, watching: false, hasInput: false })).toBe("success");
    expect(loginMascotState({ phase: "blocked", error: null, busy: false, watching: false, hasInput: false })).toBe("banned");
  });
});

describe("login error copy", () => {
  it("maps Appwrite English errors to Khmer", () => {
    expect(loginErrorKh(new Error("Invalid token passed in the request."), "verify")).toBe("លេខកូដមិនត្រឹមត្រូវ សូមព្យាយាមម្តងទៀត");
    expect(loginErrorKh(new Error("User token expired."), "verify")).toBe("លេខកូដផុតកំណត់ សូមផ្ញើឡើងវិញ");
    expect(loginErrorKh(new Error("Failed to fetch"), "send")).toBe("បណ្តាញមានបញ្ហា សូមព្យាយាមម្តងទៀត");
    expect(loginErrorKh({ code: 429, message: "Rate limit" }, "send")).toContain("ញិកញាប់");
  });

  it("keeps Khmer messages that are already localised", () => {
    expect(loginErrorKh(new Error("អ៊ីមែលមិនត្រឹមត្រូវ — សូមពិនិត្យម្តងទៀត។"), "send")).toBe("អ៊ីមែលមិនត្រឹមត្រូវ — សូមពិនិត្យម្តងទៀត។");
  });
});

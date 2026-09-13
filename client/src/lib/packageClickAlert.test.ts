import { describe, expect, it } from "vitest";
import {
  packageAccountCheckNoticeKh,
  packageClickAlertCopy,
  packageHasClickAlert,
  weeklyPassCapNoticeKh,
  weeklyPassClickNote,
  weeklyPassStackCount,
} from "./packageClickAlert";

describe("package click alert", () => {
  it("does not nag on diamond packs — those just select", () => {
    const diamond = { label: "86 Diamonds", amountLabel: "86 Diamonds", priceLabel: "$1.10", quantity: 1 };
    expect(packageHasClickAlert(diamond)).toBe(false);
    const copy = packageClickAlertCopy(diamond);
    expect(copy.body).toBe("");
    expect(copy.body).not.toContain(packageAccountCheckNoticeKh);
    expect(copy.title).toBe("86 Diamonds");
    expect(packageHasClickAlert({ label: "275 ពេជ្យ", amountLabel: "275 ពេជ្យ", priceLabel: "$3.49" })).toBe(false);
  });

  it("shows Kagura-style weekly notes and N purchases for stacked weekly cards", () => {
    expect(weeklyPassStackCount({ label: "2x Weekly", amountLabel: "2x Weekly", priceLabel: "$3.18", quantity: 2 })).toBe(2);
    expect(weeklyPassStackCount({ label: "Weekly Pass", amountLabel: "Weekly Pass", priceLabel: "$1.59", quantity: 1 })).toBe(1);
    expect(weeklyPassStackCount({ label: "Weekly Pass x2", amountLabel: "Weekly Pass x2", priceLabel: "$3.00", quantity: 1 })).toBe(2);
    const note = weeklyPassClickNote(2);
    expect(note).toContain("160 ពេជ្យ");
    expect(note).toContain("14 ថ្ងៃ");
    expect(note).toContain("440 ពេជ្យ");
    expect(note).toContain("56 ថ្ងៃ");
    expect(note).toContain("ZURS នឹងទិញ Weekly Pass ចំនួន 2 ដង");
    expect(note).toContain(weeklyPassCapNoticeKh);
    const item = { label: "2x Weekly", amountLabel: "2x Weekly", priceLabel: "$3.18", quantity: 2 };
    expect(packageHasClickAlert(item)).toBe(true);
    const alert = packageClickAlertCopy(item);
    expect(alert.body).toContain("ZURS នឹងទិញ Weekly Pass ចំនួន 2 ដង");
    expect(alert.body).toContain(packageAccountCheckNoticeKh);
    const verified = packageClickAlertCopy(item, { accountVerified: true });
    expect(verified.body).toContain("ZURS នឹងទិញ Weekly Pass ចំនួន 2 ដង");
    expect(verified.body).not.toContain(packageAccountCheckNoticeKh);
  });

  it("uses Kagura bundle notes for elite and monthly packs", () => {
    expect(packageHasClickAlert({ label: "Weekly Elite Bundle", amountLabel: "Weekly Elite Bundle", priceLabel: "$0.90" })).toBe(true);
    expect(packageClickAlertCopy({ label: "Weekly Elite Bundle", amountLabel: "Weekly Elite Bundle", priceLabel: "$0.90" }).body).toContain("55 ពេជ្យ");
    expect(packageClickAlertCopy({ label: "Monthly Epic Bundle", amountLabel: "Monthly Epic Bundle", priceLabel: "$4.29" }).body).toContain("275 ពេជ្យ");
    expect(packageClickAlertCopy({ label: "Weekly Elite Bundle", amountLabel: "Weekly Elite Bundle", priceLabel: "$0.90" }, { accountVerified: true }).body).not.toContain(packageAccountCheckNoticeKh);
  });
});

import { describe, expect, it } from "vitest";
import {
  packageAccountCheckNoticeKh,
  packageClickAlertCopy,
  weeklyPassCapNoticeKh,
  weeklyPassClickNote,
  weeklyPassStackCount,
} from "./packageClickAlert";

describe("package click alert", () => {
  it("always asks the buyer to check the account name first", () => {
    const diamond = packageClickAlertCopy({ label: "86 Diamonds", amountLabel: "86 Diamonds", priceLabel: "$1.10", quantity: 1 });
    expect(diamond.body).toContain(packageAccountCheckNoticeKh);
    expect(diamond.title).toBe("86 Diamonds");
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
    const alert = packageClickAlertCopy({ label: "2x Weekly", amountLabel: "2x Weekly", priceLabel: "$3.18", quantity: 2 });
    expect(alert.body).toContain("ZURS នឹងទិញ Weekly Pass ចំនួន 2 ដង");
    expect(alert.body).toContain(packageAccountCheckNoticeKh);
  });

  it("uses Kagura bundle notes for elite and monthly packs", () => {
    expect(packageClickAlertCopy({ label: "Weekly Elite Bundle", amountLabel: "Weekly Elite Bundle", priceLabel: "$0.90" }).body).toContain("55 ពេជ្យ");
    expect(packageClickAlertCopy({ label: "Monthly Epic Bundle", amountLabel: "Monthly Epic Bundle", priceLabel: "$4.29" }).body).toContain("275 ពេជ្យ");
  });
});

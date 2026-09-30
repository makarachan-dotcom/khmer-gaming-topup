import { describe, expect, it } from "vitest";
import { isForeignCountryNamedProduct } from "./countryNameFilter";

describe("name-based foreign-country filter", () => {
  it("removes only names that explicitly name another country", () => {
    expect(isForeignCountryNamedProduct("Mobile Legends (Philippines)")).toBe(true);
    expect(isForeignCountryNamedProduct("Mobile Legends Philippines")).toBe(true);
    expect(isForeignCountryNamedProduct("86 Diamonds (Indonesia)")).toBe(true);
    expect(isForeignCountryNamedProduct("Arena of Valor (TH) Region: Thailand")).toBe(true);
    expect(isForeignCountryNamedProduct("Diamonds MY/SG")).toBe(true);
    expect(isForeignCountryNamedProduct("Mobile Legends (PH)")).toBe(true);
    expect(isForeignCountryNamedProduct("Weekly Pass (ID)")).toBe(true);
    expect(isForeignCountryNamedProduct("86 Diamonds 🇵🇭")).toBe(true);
    expect(isForeignCountryNamedProduct("Twilight Pass (MENA)")).toBe(true);
    expect(isForeignCountryNamedProduct("Diamonds (LATAM)")).toBe(true);
    expect(isForeignCountryNamedProduct("Top-up Vietnam")).toBe(true);
    expect(isForeignCountryNamedProduct("MLBB Diamonds Malaysia")).toBe(true);
  });

  it("keeps regional category names, Global, Cambodia, and unmarked names", () => {
    // Regional category display names stay listed — the filter is name-only
    // and never excludes on a region slug.
    expect(isForeignCountryNamedProduct("Mobile Legends")).toBe(false);
    expect(isForeignCountryNamedProduct("Mobile Legends Global")).toBe(false);
    expect(isForeignCountryNamedProduct("Mobile Legends Promo")).toBe(false);
    expect(isForeignCountryNamedProduct("Mobile Legends (Global)")).toBe(false);
    expect(isForeignCountryNamedProduct("86 Diamonds")).toBe(false);
    expect(isForeignCountryNamedProduct("(78+8) Diamonds")).toBe(false);
    expect(isForeignCountryNamedProduct("Weekly Diamond Pass")).toBe(false);
    expect(isForeignCountryNamedProduct("EA FC Mobile (KH)")).toBe(false);
    expect(isForeignCountryNamedProduct("PUBG Mobile (Cambodia)")).toBe(false);
    expect(isForeignCountryNamedProduct("Mobile Legends Khmer")).toBe(false);
    expect(isForeignCountryNamedProduct("Telegram Stars")).toBe(false);
    expect(isForeignCountryNamedProduct("8 Ball Pool")).toBe(false);
  });

  it("never mistakes ordinary labels for country markers", () => {
    // "ID" also means identifier, "US" also means "us" — bare codes are not matched.
    expect(isForeignCountryNamedProduct("Player ID")).toBe(false);
    expect(isForeignCountryNamedProduct("Enter your user ID")).toBe(false);
    expect(isForeignCountryNamedProduct("Contact us for support")).toBe(false);
    expect(isForeignCountryNamedProduct("86 Diamonds x2")).toBe(false);
    expect(isForeignCountryNamedProduct("")).toBe(false);
    expect(isForeignCountryNamedProduct(null)).toBe(false);
    expect(isForeignCountryNamedProduct(undefined)).toBe(false);
  });

  it("always keeps Free Fire, in every region", () => {
    expect(isForeignCountryNamedProduct("Free Fire")).toBe(false);
    expect(isForeignCountryNamedProduct("Free Fire (SG)")).toBe(false);
    expect(isForeignCountryNamedProduct("Free Fire (MY/SG)")).toBe(false);
    expect(isForeignCountryNamedProduct("Free Fire (CIS)")).toBe(false);
    expect(isForeignCountryNamedProduct("Free Fire (LATAM)")).toBe(false);
    expect(isForeignCountryNamedProduct("Free Fire (MENA)")).toBe(false);
    expect(isForeignCountryNamedProduct("Free Fire Philippines")).toBe(false);
    expect(isForeignCountryNamedProduct("100 Diamonds Free Fire")).toBe(false);
  });
});

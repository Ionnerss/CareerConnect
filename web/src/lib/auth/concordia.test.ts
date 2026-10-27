import { describe, expect, it } from "vitest";
import { isConcordiaEmail } from "./concordia";

describe("isConcordiaEmail accepts Concordia addresses", () => {
  it.each([
    "name@concordia.ca",
    "student.name.20241@mail.concordia.ca",
    "y_name@live.concordia.ca",
    "name@encs.concordia.ca",
    "name@users.encs.concordia.ca",
    "first-last@alumni.concordia.ca",
  ])("%s", (email) => {
    expect(isConcordiaEmail(email)).toBe(true);
  });

  it("ignores capital letters and surrounding spaces", () => {
    expect(isConcordiaEmail("  Name@Live.Concordia.CA  ")).toBe(true);
  });
});

describe("isConcordiaEmail rejects everything else", () => {
  it.each([
    "name@gmail.com",
    "name@concordia.com",
    "name@concordia.qc.ca",
    "name@evilconcordia.ca",
    "name@concordia.ca.evil.com",
    "name@evil.com.concordia.ca.org",
    "name@.concordia.ca",
    "name@concordia.ca@evil.com",
    "name@evil.com@concordia.ca",
    "name concordia@concordia.ca",
    "@concordia.ca",
    "concordia.ca",
    "name@concordia",
    "",
  ])("%j", (email) => {
    expect(isConcordiaEmail(email)).toBe(false);
  });

  it("rejects missing values", () => {
    expect(isConcordiaEmail(null)).toBe(false);
    expect(isConcordiaEmail(undefined)).toBe(false);
  });
});

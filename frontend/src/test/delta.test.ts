import { changeDelta } from "../delta";

test("date slips show days and months, warn past a year", () => {
  expect(changeDelta("2025-12-31", "2026-05-31")).toEqual({ main: "+151 days", sub: "≈ 5.0 mo later", tone: "neutral" });
  expect(changeDelta("2026-06-01", "2028-06-01")).toEqual({ main: "+731 days", sub: "≈ 24.0 mo later", tone: "warn" });
  expect(changeDelta("2026-12-31", "2026-05-31")).toEqual({ main: "−214 days", sub: "≈ 7.0 mo earlier", tone: "ok" });
});

test("cost changes show dollars and percent, warn past 50%, ok when cheaper", () => {
  expect(changeDelta("$23,787,423", "$28,578,734")).toEqual({ main: "+$4.79M", sub: "+20.1%", tone: "neutral" });
  expect(changeDelta("$34,880,000", "$54,450,000")).toEqual({ main: "+$19.57M", sub: "+56.1%", tone: "warn" });
  expect(changeDelta("$28,578,734", "$19,280,474")).toEqual({ main: "−$9.30M", sub: "−32.5%", tone: "ok" });
});

test("anything else has no delta", () => {
  expect(changeDelta("Riverport Tap", "Sherwood Tap")).toBeNull();
  expect(changeDelta(null, "2026-01-01")).toBeNull();
  expect(changeDelta("IRP 2027", "SERTP 2026: 2028")).toBeNull();
});

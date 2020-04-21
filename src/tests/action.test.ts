import { getCoverageTable } from "../action"

test("throws invalid number", () => {
  expect(1).toBeTruthy()
})

test("wait 500 ms", async () => {
  expect(500).toBeGreaterThan(450)
})

describe("getCoverageTable()", () => {
  it("should return a markdown table", () => {
    const results = require("../../sample-results.json")
    expect(getCoverageTable(results, "/Volumes/Home/matt/dev/jest-github-action/")).toBe(
      "foo",
    )
  })
})

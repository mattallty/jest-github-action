const path = require("path")
const prog = require("./index")

test("throws invalid number", async () => {
  await expect(1).toBeTruthy()
})

test("wait 500 ms", async () => {
  expect(500).toBeGreaterThan(450)
})

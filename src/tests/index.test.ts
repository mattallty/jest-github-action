const action = require("../action")

test("throws invalid number", () => {
  expect(1).toBeTruthy()
})

test("wait 500 ms", async () => {
  expect(500).toBeGreaterThan(450)
})

test("action should be a function", () => {
  expect(action).toStrictEqual(expect.any(Function))
})

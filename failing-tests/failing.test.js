describe("My test suite", () => {
  test("this one should fail", () => {
    expect(1).toBe(2)
  })
  test("this another one should also fail", () => {
    const str = "I'm in the kitchen."
    expect(str).toBe("I'm in the garden.")
  })
  test("this one should work", () => {
    expect(1).toBeTruthy()
  })
  test("this one should also work", () => {
    expect(true).toBeTruthy()
  })
})

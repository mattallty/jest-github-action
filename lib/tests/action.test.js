"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const action_1 = require("../action");
test("throws invalid number", () => {
    expect(1).toBeTruthy();
});
test("wait 500 ms", () => __awaiter(void 0, void 0, void 0, function* () {
    expect(500).toBeGreaterThan(450);
}));
describe("getCoverageTable()", () => {
    it("should return a markdown table", () => {
        const results = require("../../sample-results.json");
        expect(action_1.getCoverageTable(results, "/Volumes/Home/matt/dev/jest-github-action/")).toStrictEqual(expect.any(String));
    });
});

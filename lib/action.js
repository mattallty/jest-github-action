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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const fs_1 = require("fs");
const exec_1 = require("@actions/exec");
const core = __importStar(require("@actions/core"));
const github_1 = require("@actions/github");
const flatMap_1 = __importDefault(require("lodash/flatMap"));
const filter_1 = __importDefault(require("lodash/filter"));
const map_1 = __importDefault(require("lodash/map"));
const strip_ansi_1 = __importDefault(require("strip-ansi"));
const markdown_table_1 = __importDefault(require("markdown-table"));
const istanbul_lib_coverage_1 = require("istanbul-lib-coverage");
const ACTION_NAME = "jest-github-action";
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        const CWD = process.cwd() + path_1.sep;
        const RESULTS_FILE = path_1.join(CWD, "jest.results.json");
        try {
            const token = process.env.GITHUB_TOKEN;
            if (token === undefined) {
                core.error("GITHUB_TOKEN not set.");
                core.setFailed("GITHUB_TOKEN not set.");
                return;
            }
            const cmd = getJestCommand(RESULTS_FILE);
            yield execJest(cmd);
            // octokit
            const octokit = new github_1.GitHub(token);
            // Parse results
            const results = parseResults(RESULTS_FILE);
            // Checks
            const checkPayload = getCheckPayload(results, CWD);
            const check = yield octokit.checks.create(checkPayload);
            console.debug("Check created: %j", check);
            // Coverage comments
            if (shouldCommentCoverage()) {
                const comment = getCoverageTable(results, CWD);
                if (comment) {
                    const commentPayload = getCommentPayload(comment);
                    const com = yield octokit.issues.createComment(commentPayload);
                    console.debug("Comment created: %j", com);
                }
            }
            if (!results.success) {
                core.setFailed("Some jest tests failed.");
            }
        }
        catch (error) {
            console.error(error);
            core.setFailed(error.message);
        }
    });
}
exports.run = run;
function shouldCommentCoverage() {
    return Boolean(JSON.parse(core.getInput("coverage-comment", { required: false })));
}
function getCoverageTable(results, cwd) {
    if (!results.coverageMap) {
        return "";
    }
    const covMap = istanbul_lib_coverage_1.createCoverageMap(results.coverageMap);
    const rows = [["Filename", "Statements", "Branches", "Functions", "Lines"]];
    if (!Object.keys(covMap.data).length) {
        console.error("No entries found in coverage data");
        return false;
    }
    for (const [filename, data] of Object.entries(covMap.data || {})) {
        const { data: summary } = data.toSummary();
        rows.push([
            filename.replace(cwd, ""),
            summary.statements.pct + "%",
            summary.branches.pct + "%",
            summary.functions.pct + "%",
            summary.lines.pct + "%",
        ]);
    }
    return (":loop: **Code coverage**\n\n" + markdown_table_1.default(rows, { align: ["l", "r", "r", "r", "r"] }));
}
exports.getCoverageTable = getCoverageTable;
function getCommentPayload(body) {
    const payload = Object.assign(Object.assign({}, github_1.context.repo), { body, issue_number: getPullId() });
    return payload;
}
function getCheckPayload(results, cwd) {
    const payload = Object.assign(Object.assign({}, github_1.context.repo), { head_sha: getSha(), name: ACTION_NAME, status: "completed", conclusion: results.success ? "success" : "failure", output: {
            title: results.success ? "Jest tests passed" : "Jest tests failed",
            text: getOutputText(results),
            summary: results.success
                ? `${results.numPassedTests} tests in ${results.numPassedTestSuites} passed`
                : `Failed tests: ${results.numFailedTests}/${results.numTotalTests}. Failed suites: ${results.numFailedTests}/${results.numTotalTestSuites}.`,
            annotations: getAnnotations(results, cwd),
        } });
    console.debug("Check payload: %j", payload);
    return payload;
}
function getJestCommand(resultsFile) {
    let cmd = core.getInput("test-command", { required: false });
    const jestOptions = `--testLocationInResults --json ${shouldCommentCoverage() ? "--coverage" : ""} --outputFile=${resultsFile}`;
    const isNpm = cmd.startsWith("npm") || cmd.startsWith("npx");
    cmd += (isNpm ? " -- " : " ") + jestOptions;
    core.debug("Final test command: " + cmd);
    return cmd;
}
function parseResults(resultsFile) {
    const results = JSON.parse(fs_1.readFileSync(resultsFile, "utf-8"));
    console.debug("Jest results: %j", results);
    return results;
}
function execJest(cmd) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield exec_1.exec(cmd, [], { silent: true });
            console.debug("Jest command executed");
        }
        catch (e) {
            console.debug("Jest execution failed. Tests have likely failed.");
        }
    });
}
function getPullId() {
    var _a, _b;
    return (_b = (_a = github_1.context.payload.pull_request) === null || _a === void 0 ? void 0 : _a.number) !== null && _b !== void 0 ? _b : 0;
}
function getSha() {
    var _a;
    try {
        return (_a = github_1.context.payload.pull_request) === null || _a === void 0 ? void 0 : _a.head.sha;
    }
    catch (e) {
        return github_1.context.sha;
    }
}
const getAnnotations = (results, cwd) => {
    if (results.success) {
        return [];
    }
    return flatMap_1.default(results.testResults, (result) => {
        return filter_1.default(result.assertionResults, ["status", "failed"]).map((assertion) => {
            var _a, _b, _c, _d, _e, _f;
            return ({
                path: result.name.replace(cwd, ""),
                start_line: (_b = (_a = assertion.location) === null || _a === void 0 ? void 0 : _a.line) !== null && _b !== void 0 ? _b : 0,
                end_line: (_d = (_c = assertion.location) === null || _c === void 0 ? void 0 : _c.line) !== null && _d !== void 0 ? _d : 0,
                annotation_level: "failure",
                title: assertion.ancestorTitles.concat(assertion.title).join(" > "),
                message: strip_ansi_1.default((_f = (_e = assertion.failureMessages) === null || _e === void 0 ? void 0 : _e.join("\n\n")) !== null && _f !== void 0 ? _f : ""),
            });
        });
    });
};
const getOutputText = (results) => {
    if (results.success) {
        return;
    }
    const entries = filter_1.default(map_1.default(results.testResults, (r) => strip_ansi_1.default(r.message)));
    return asMarkdownCode(entries.join("\n"));
};
function asMarkdownCode(str) {
    return "```\n" + str.trimRight() + "\n```";
}

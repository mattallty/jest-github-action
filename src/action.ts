import { sep, join } from "path"
import { readFileSync } from "fs"
import { exec } from "@actions/exec"
import * as core from "@actions/core"
import { GitHub, context } from "@actions/github"
import type { Octokit } from "@octokit/rest"
import flatMap from "lodash/flatMap"
import filter from "lodash/filter"
import map from "lodash/map"
import strip from "strip-ansi"
import table from "markdown-table"
import { createCoverageMap, CoverageMapData } from "istanbul-lib-coverage"
import type { FormattedTestResults } from "@jest/test-result/build/types"

const ACTION_NAME = "jest-github-action"

export async function run() {
  const CWD = process.cwd() + sep
  const RESULTS_FILE = join(CWD, "jest.results.json")

  try {
    const token = process.env.GITHUB_TOKEN
    if (token === undefined) {
      core.error("GITHUB_TOKEN not set.")
      core.setFailed("GITHUB_TOKEN not set.")
      return
    }

    console.dir(context)

    const cmd = getJestCommand(RESULTS_FILE)

    await execJest(cmd)

    // octokit
    const octokit = new GitHub(token)

    // Parse results
    const results = parseResults(RESULTS_FILE)

    // Checks
    const checkPayload = getCheckPayload(results, CWD)
    const check = await octokit.checks.create(checkPayload)
    console.debug("Check created: %j", check)

    // Coverage comments
    if (shouldCommentCoverage()) {
      const comment = getCoverageTable(results, CWD)
      if (comment) {
        const commentPayload = getCommentPayload(comment)
        const com = await octokit.issues.createComment(commentPayload)
        console.debug("Comment created: %j", com)
      }
    }

    if (!results.success) {
      core.setFailed("Some jest tests failed.")
    }
  } catch (error) {
    console.error(error)
    core.setFailed(error.message)
  }
}

function deletePreviousComments() {}

function shouldCommentCoverage(): boolean {
  return Boolean(JSON.parse(core.getInput("coverage-comment", { required: false })))
}

export function getCoverageTable(
  results: FormattedTestResults,
  cwd: string,
): string | false {
  if (!results.coverageMap) {
    return ""
  }
  const covMap = createCoverageMap((results.coverageMap as unknown) as CoverageMapData)
  const rows = [["Filename", "Statements", "Branches", "Functions", "Lines"]]

  if (!Object.keys(covMap.data).length) {
    console.error("No entries found in coverage data")
    return false
  }

  for (const [filename, data] of Object.entries(covMap.data || {})) {
    const { data: summary } = data.toSummary()
    rows.push([
      filename.replace(cwd, ""),
      summary.statements.pct + "%",
      summary.branches.pct + "%",
      summary.functions.pct + "%",
      summary.lines.pct + "%",
    ])
  }

  return (
    ":loop: **Code coverage**\n\n" + table(rows, { align: ["l", "r", "r", "r", "r"] })
  )
}

function getCommentPayload(body: string) {
  const payload: Octokit.IssuesCreateCommentParams = {
    ...context.repo,
    body,
    issue_number: getPullId(),
  }
  return payload
}

function getCheckPayload(results: FormattedTestResults, cwd: string) {
  const payload: Octokit.ChecksCreateParams = {
    ...context.repo,
    head_sha: getSha(),
    name: ACTION_NAME,
    status: "completed",
    conclusion: results.success ? "success" : "failure",
    output: {
      title: results.success ? "Jest tests passed" : "Jest tests failed",
      text: getOutputText(results),
      summary: results.success
        ? `${results.numPassedTests} tests in ${results.numPassedTestSuites} passed`
        : `Failed tests: ${results.numFailedTests}/${results.numTotalTests}. Failed suites: ${results.numFailedTests}/${results.numTotalTestSuites}.`,

      annotations: getAnnotations(results, cwd),
    },
  }
  console.debug("Check payload: %j", payload)
  return payload
}

function getJestCommand(resultsFile: string) {
  let cmd = core.getInput("test-command", { required: false })
  const jestOptions = `--testLocationInResults --json ${
    shouldCommentCoverage() ? "--coverage" : ""
  } --outputFile=${resultsFile}`
  const isNpm = cmd.startsWith("npm") || cmd.startsWith("npx")
  cmd += (isNpm ? " -- " : " ") + jestOptions
  core.debug("Final test command: " + cmd)
  return cmd
}

function parseResults(resultsFile: string): FormattedTestResults {
  const results = JSON.parse(readFileSync(resultsFile, "utf-8"))
  console.debug("Jest results: %j", results)
  return results
}

async function execJest(cmd: string) {
  try {
    await exec(cmd, [], { silent: true })
    console.debug("Jest command executed")
  } catch (e) {
    console.debug("Jest execution failed. Tests have likely failed.")
  }
}

function getPullId(): number {
  return context.payload.pull_request?.number ?? 0
}

function getSha(): string {
  try {
    return context.payload.pull_request?.head.sha
  } catch (e) {
    return context.sha
  }
}

const getAnnotations = (
  results: FormattedTestResults,
  cwd: string,
): Octokit.ChecksCreateParamsOutputAnnotations[] => {
  if (results.success) {
    return []
  }
  return flatMap(results.testResults, (result) => {
    return filter(result.assertionResults, ["status", "failed"]).map((assertion) => ({
      path: result.name.replace(cwd, ""),
      start_line: assertion.location?.line ?? 0,
      end_line: assertion.location?.line ?? 0,
      annotation_level: "failure",
      title: assertion.ancestorTitles.concat(assertion.title).join(" > "),
      message: strip(assertion.failureMessages?.join("\n\n") ?? ""),
    }))
  })
}

const getOutputText = (results: FormattedTestResults) => {
  if (results.success) {
    return
  }
  const entries = filter(map(results.testResults, (r) => strip(r.message)))
  return asMarkdownCode(entries.join("\n"))
}

function asMarkdownCode(str: string) {
  return "```\n" + str.trimRight() + "\n```"
}

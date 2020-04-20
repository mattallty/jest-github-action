const core = require("@actions/core")
const { GitHub, context } = require("@actions/github")
const exec = require("@actions/exec")
const process = require("process")
const path = require("path")
const pkg = require("./package")
const flatMap = require("lodash/flatMap")
const map = require("lodash/map")
const filter = require("lodash/filter")

const RESULTS_FILE = "jest.results.json"
const CWD = process.cwd() + path.sep

// most @actions toolkit packages have async methods
async function run() {
  try {
    // const token = core.getInput("github-token", { required: true })
    const token = process.env.GITHUB_TOKEN
    let cmd = core.getInput("test-command", { required: false })
    const reportOnSuccess = !!core.getInput("on-success", { required: false })

    if (
      cmd.startsWith("npm") ||
      cmd.startsWith("yarn") ||
      cmd.startsWith("npx")
    ) {
      cmd += ` -- --testLocationInResults --json --outputFile=${RESULTS_FILE}`
    }

    console.log("Token length: " + token.length)

    const octokit = new GitHub(token)

    try {
      await exec.exec(cmd)
    } catch (e) {
      // Some errors should be reported
    }

    const results = require(RESULTS_FILE)

    if (results.success && !reportOnSuccess) {
      return
    }

    const getOutputText = () => {
      if (results.success) {
        return
      }
      const entries = filter(map(results.testResults, "message"))
      return "- " + entries.join("\n- ")
    }

    const getAnnotations = () => {
      if (results.success) {
        return []
      }
      const entries = flatMap(results.testResults, (result) => {
        if (result.status !== "failed") {
          return
        }
        return result.assertionResults.map((a) => {
          return {
            path: a.name.replace(CWD, ""),
            start_line: a.location.line,
            end_line: a.location.line,
            start_column: a.location.column,
            end_column: a.location.column,
            annotation_level: "failure",
            title: a.ancestorTitles.concat(a.title).join(" > "),
            message: result.message,
            raw_details: a.failureMessages.join("\n\n"),
          }
        })
      })

      return "- " + entries.join("\n- ")
    }

    octokit.checks.create({
      ...context.repo,
      head_sha: context.sha,
      name: pkg.name,
      status: "completed",
      conclusion: results.success ? "success" : "failure",
      output: {
        title: results.success ? "Jest tests passed" : "Jest tests failed",
        text: getOutputText(),
        summary: results.success
          ? `${results.numPassedTests} tests in ${results.numPassedTestSuites} passed`
          : `Failed tests: ${results.numFailedTests}/${results.numTotalTests}. Failed suites: ${results.numFailedTests}/${results.numTotalTestSuites}.`,

        annotations: getAnnotations(),
      },
    })
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()

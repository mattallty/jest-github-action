const core = require("@actions/core")
const { GitHub, context } = require("@actions/github")
const exec = require("@actions/exec")
const process = require("process")
const path = require("path")
const fs = require("fs")
const pkg = require("./package")
const flatMap = require("lodash/flatMap")
const map = require("lodash/map")
const filter = require("lodash/filter")
const strip = require("strip-ansi")

// most @actions toolkit packages have async methods
async function run() {
  const CWD = process.cwd() + path.sep
  const RESULTS_FILE = path.join(CWD, "jest.results.json")

  try {
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

    console.log("Final test command: " + cmd)
    const octokit = new GitHub(token)

    try {
      await exec.exec(cmd)
      console.log("Jest command executed")
    } catch (e) {
      console.error("Error while executing jest. Looks like some tests failed.")
      // console.error(e)
      // Some errors should be reported
    }

    const results = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf-8"))
    console.log("Jest results:")
    console.dir(results, { depth: 10 })

    if (results.success && !reportOnSuccess) {
      console.log("Skipping reporting success")
      return
    }

    const getOutputText = () => {
      if (results.success) {
        return
      }
      const entries = filter(map(results.testResults, (r) => strip(r.message)))
      return "```\n" + entries.join("\n") + "```"
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
            path: result.name.replace(CWD, ""),
            start_line: a.location.line,
            end_line: a.location.line,
            // start_column: a.location.column,
            // end_column: a.location.column,
            annotation_level: "failure",
            title: a.ancestorTitles.concat(a.title).join(" > "),
            message: strip(result.message),
          }
        })
      })
      return filter(entries)
    }

    const payload = {
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
    }

    console.log("Creating check", payload)
    const check = await octokit.checks.create(payload)
    console.log("Check created", check)
    // core.setFailed("Some tests failed.")
  } catch (error) {
    console.error(error.message)
    core.setFailed(error.message)
  }
}

module.exports = run

if (require.main === module) {
  run()
}

const table = require("markdown-table")

class JestGithubActionReporter {
  constructor(globalConfig, options) {
    this._globalConfig = globalConfig
    this._options = { options, ...{ hello: "var" } }
    console.log(options)
  }

  onRunComplete(contexts, testResult) {
    const rows = [["Filename", "Statements", "Branches", "Functions", "Lines"]]
    const { rootDir } = this._globalConfig
    // console.dir(testResult, { depth: 5 })

    if (!testResult.coverageMap) {
      console.debug("Coverage not generated")
      return
    }

    for (const [filename, data] of Object.entries(
      testResult.coverageMap.data || {}
    )) {
      const { data: summary } = data.toSummary()
      rows.push([
        filename.replace(rootDir, ""),
        summary.statements.pct + "%",
        summary.branches.pct + "%",
        summary.functions.pct + "%",
        summary.lines.pct + "%",
      ])
    }
    // console.log(table(rows, { align: ["l", "r", "r", "r", "r"] }))
  }

  onTestResult(contexts, testResult) {
    console.dir(testResult)
  }
}

module.exports = JestGithubActionReporter

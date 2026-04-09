module.exports = async function runDeployValidationGate({ github, context, core }) {
  const { owner, repo } = context.repo
  const timeoutMs = 15 * 60 * 1000
  const intervalMs = 15000
  const start = Date.now()
  const targetRef = process.env.TARGET_REF || context.sha

  async function getCommit(ref) {
    const commit = await github.rest.repos.getCommit({ owner, repo, ref })
    return commit.data
  }

  const targetCommit = context.eventName === 'push'
    ? {
        sha: context.sha,
        parents: (context.payload.head_commit?.parents || []).map((parent) => ({ sha: parent })),
        files: [],
      }
    : await getCommit(targetRef)
  const targetSha = targetCommit.sha

  function matchesPattern(file, pattern) {
    if (pattern.endsWith('/**')) {
      return file.startsWith(pattern.slice(0, -2))
    }
    if (pattern === '*.md') {
      return !file.includes('/') && file.endsWith('.md')
    }
    return file === pattern
  }

  function matchesAny(file, patterns) {
    return patterns.some((pattern) => matchesPattern(file, pattern))
  }

  async function waitForWorkflow(workflowFile, label) {
    async function getRun() {
      const runs = await github.rest.actions.listWorkflowRuns({
        owner,
        repo,
        workflow_id: workflowFile,
        head_sha: targetSha,
        per_page: 10,
      })
      return runs.data.workflow_runs[0]
    }

    let run
    while (Date.now() - start < timeoutMs) {
      run = await getRun()
      if (run && run.status === 'completed') {
        if (run.conclusion === 'success') {
          core.info(`${label} succeeded: ${run.html_url}`)
          return true
        }
        core.setFailed(`${label} not successful (conclusion=${run.conclusion}). ${run.html_url}`)
        return false
      }
      core.info(`Waiting for ${label} to complete...`)
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }

    core.setFailed(`Timed out waiting for ${label} to succeed.`)
    return false
  }

  const workflowsToWaitFor = []
  const changedFiles = []

  if (context.eventName === 'push') {
    const before = context.payload.before
    if (before && !/^0+$/.test(before)) {
      const comparison = await github.rest.repos.compareCommits({
        owner,
        repo,
        base: before,
        head: targetSha,
      })
      for (const file of comparison.data.files || []) {
        if (file?.filename) changedFiles.push(file.filename)
      }
    }
  } else {
    const firstParentSha = targetCommit.parents?.[0]?.sha || ''
    if (firstParentSha) {
      const comparison = await github.rest.repos.compareCommits({
        owner,
        repo,
        base: firstParentSha,
        head: targetSha,
      })
      for (const file of comparison.data.files || []) {
        if (file?.filename) changedFiles.push(file.filename)
      }
    } else {
      for (const file of targetCommit.files || []) {
        if (file?.filename) changedFiles.push(file.filename)
      }
    }
  }

  const ciIgnoredPatterns = ['apps/frontend/**', 'docs/**', '*.md']
  const frontendPatterns = ['apps/frontend/**', '.github/workflows/frontend-ci.yml']

  const requiresCi = changedFiles.some((file) => !matchesAny(file, ciIgnoredPatterns))
  const requiresFrontendCi = changedFiles.some((file) => matchesAny(file, frontendPatterns))

  if (requiresCi) {
    workflowsToWaitFor.push({ file: '.github/workflows/ci.yml', label: 'CI workflow' })
  }
  if (requiresFrontendCi) {
    workflowsToWaitFor.push({ file: '.github/workflows/frontend-ci.yml', label: 'Frontend CI workflow' })
  }

  core.setOutput('target_ref', targetRef)
  core.setOutput('target_sha', targetSha)
  core.setOutput('changed_files_count', String(changedFiles.length))
  core.setOutput('changed_files', changedFiles.join('\n'))
  core.setOutput('required_workflows', workflowsToWaitFor.map((item) => item.label).join(', ') || 'none')

  core.info(`Target ref: ${targetRef}`)
  core.info(`Target sha: ${targetSha}`)
  core.info(`Changed files (${changedFiles.length}): ${changedFiles.join(', ') || 'none detected'}`)
  core.info(`Required validations: ${workflowsToWaitFor.map((item) => item.label).join(', ') || 'none'}`)

  for (const workflow of workflowsToWaitFor) {
    const ok = await waitForWorkflow(workflow.file, workflow.label)
    if (!ok) {
      return
    }
  }
}

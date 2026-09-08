module.exports = async function runCiMetrics({ github, context, core, now = Date.now() }) {
  const trackedWorkflows = new Set([
    "CI - dev pull request",
    "CI - release",
  ]);
  const since = now - 7 * 24 * 60 * 60 * 1000;
  const created = `>=${new Date(since).toISOString().slice(0, 10)}`;
  const runs = await github.paginate(
    github.rest.actions.listWorkflowRunsForRepo,
    {
      ...context.repo,
      status: "completed",
      created,
      per_page: 100,
    },
  );
  const recentRuns = runs.filter(
    (run) =>
      trackedWorkflows.has(run.name) &&
      new Date(run.created_at).getTime() >= since,
  );

  const percentile = (values, ratio) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.ceil(sorted.length * ratio) - 1];
  };
  const minutes = (milliseconds) =>
    Math.round((milliseconds / 60000) * 10) / 10;

  const elapsed = (start, end) =>
    Math.max(0, new Date(end).getTime() - new Date(start).getTime());

  const jobsByRun = new Map();
  for (const run of recentRuns) {
    const jobs = await github.paginate(
      github.rest.actions.listJobsForWorkflowRun,
      {
        ...context.repo,
        run_id: run.id,
        filter: "latest",
        per_page: 100,
      },
    );
    jobsByRun.set(run.id, jobs);
  }

  const workflowRows = [];
  const executionRows = [];
  for (const workflowName of trackedWorkflows) {
    const workflowRuns = recentRuns.filter(
      (run) => run.name === workflowName,
    );
    const endToEndDurations = workflowRuns.map((run) =>
      elapsed(run.created_at, run.updated_at),
    );
    const attemptDurations = workflowRuns.map((run) =>
      elapsed(run.run_started_at ?? run.created_at, run.updated_at),
    );
    const runExecution = workflowRuns
      .map((run) => {
        const attemptStart = run.run_started_at ?? run.created_at;
        const validationJobs = (jobsByRun.get(run.id) ?? []).filter(
          (job) =>
            job.started_at &&
            job.completed_at &&
            job.steps?.some((step) => step.name === "Check out repository"),
        );

        if (validationJobs.length === 0) return null;

        return {
          criticalJob: Math.max(
            ...validationJobs.map((job) =>
              elapsed(job.started_at, job.completed_at),
            ),
          ),
          maxStartDelay: Math.max(
            ...validationJobs.map((job) =>
              elapsed(attemptStart, job.started_at),
            ),
          ),
        };
      })
      .filter(Boolean);
    const failures = workflowRuns.filter(
      (run) => run.conclusion === "failure",
    ).length;
    const cancellations = workflowRuns.filter(
      (run) => run.conclusion === "cancelled",
    ).length;
    const reruns = workflowRuns.filter(
      (run) => run.run_attempt > 1,
    ).length;
    workflowRows.push([
      workflowName,
      String(workflowRuns.length),
      `${minutes(percentile(attemptDurations, 0.5))} min`,
      `${minutes(percentile(attemptDurations, 0.95))} min`,
      `${minutes(percentile(endToEndDurations, 0.5))} min`,
      `${minutes(percentile(endToEndDurations, 0.95))} min`,
      `${failures}`,
      `${cancellations}`,
      workflowRuns.length === 0
        ? "0%"
        : `${Math.round((reruns / workflowRuns.length) * 100)}%`,
    ]);
    executionRows.push([
      workflowName,
      `${minutes(percentile(runExecution.map((run) => run.maxStartDelay), 0.5))} min`,
      `${minutes(percentile(runExecution.map((run) => run.maxStartDelay), 0.95))} min`,
      `${minutes(percentile(runExecution.map((run) => run.criticalJob), 0.5))} min`,
      `${minutes(percentile(runExecution.map((run) => run.criticalJob), 0.95))} min`,
    ]);
  }

  const failedJobs = new Map();
  for (const run of recentRuns) {
    if (run.conclusion !== "failure") continue;
    for (const job of jobsByRun.get(run.id) ?? []) {
      if (!["failure", "timed_out"].includes(job.conclusion)) continue;
      failedJobs.set(job.name, (failedJobs.get(job.name) ?? 0) + 1);
    }
  }

  core.summary
    .addHeading("CI metrics - last seven days")
    .addTable([
      [
        { data: "Workflow", header: true },
        { data: "Runs", header: true },
        { data: "Attempt median", header: true },
        { data: "Attempt p95", header: true },
        { data: "End-to-end median", header: true },
        { data: "End-to-end p95", header: true },
        { data: "Failures", header: true },
        { data: "Cancelled", header: true },
        { data: "Rerun rate", header: true },
      ],
      ...workflowRows,
    ])
    .addHeading("Execution breakdown", 2)
    .addTable([
      [
        { data: "Workflow", header: true },
        { data: "Max job start median", header: true },
        { data: "Max job start p95", header: true },
        { data: "Critical job median", header: true },
        { data: "Critical job p95", header: true },
      ],
      ...executionRows,
    ])
    .addHeading("Failed jobs", 2);

  if (failedJobs.size === 0) {
    core.summary.addRaw("No failed jobs in the measured period.\n");
  } else {
    core.summary.addTable([
      [
        { data: "Job", header: true },
        { data: "Failures", header: true },
      ],
      ...[...failedJobs.entries()]
        .sort((left, right) => right[1] - left[1])
        .map(([name, count]) => [name, String(count)]),
    ]);
  }

  core.summary.addRaw(
    "Attempt duration starts at the current attempt's `run_started_at`; end-to-end duration starts at the original run creation and therefore includes earlier attempts and recovery gaps. Max job start measures the slowest validation job's start relative to the current attempt. Critical job is the longest validation job execution. Cancelled superseded PR runs are reported separately from failures.\n",
  );
  await core.summary.write();
};

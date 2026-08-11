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

  const workflowRows = [];
  for (const workflowName of trackedWorkflows) {
    const workflowRuns = recentRuns.filter(
      (run) => run.name === workflowName,
    );
    const durations = workflowRuns.map((run) =>
      new Date(run.updated_at).getTime() -
      new Date(run.created_at).getTime(),
    );
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
      `${minutes(percentile(durations, 0.5))} min`,
      `${minutes(percentile(durations, 0.95))} min`,
      `${failures}`,
      `${cancellations}`,
      workflowRuns.length === 0
        ? "0%"
        : `${Math.round((reruns / workflowRuns.length) * 100)}%`,
    ]);
  }

  const failedJobs = new Map();
  for (const run of recentRuns) {
    if (run.conclusion !== "failure") continue;
    const jobs = await github.paginate(
      github.rest.actions.listJobsForWorkflowRun,
      {
        ...context.repo,
        run_id: run.id,
        filter: "latest",
        per_page: 100,
      },
    );
    for (const job of jobs) {
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
        { data: "Median", header: true },
        { data: "P95", header: true },
        { data: "Failures", header: true },
        { data: "Cancelled", header: true },
        { data: "Rerun rate", header: true },
      ],
      ...workflowRows,
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
    "Durations include queue time. Cancelled superseded PR runs are reported separately from failures.\n",
  );
  await core.summary.write();
};

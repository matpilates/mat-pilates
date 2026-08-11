const assert = require("node:assert/strict");
const test = require("node:test");

const runCiMetrics = require("./ci-metrics.cjs");

function createSummary() {
  return {
    headings: [],
    tables: [],
    raws: [],
    writes: 0,
    addHeading(...heading) {
      this.headings.push(heading);
      return this;
    },
    addTable(table) {
      this.tables.push(table);
      return this;
    },
    addRaw(raw) {
      this.raws.push(raw);
      return this;
    },
    async write() {
      this.writes += 1;
    },
  };
}

test("summarizes normalized workflow-run and job arrays", async () => {
  const listWorkflowRunsForRepo = Symbol("listWorkflowRunsForRepo");
  const listJobsForWorkflowRun = Symbol("listJobsForWorkflowRun");
  const summary = createSummary();
  const calls = [];
  const now = Date.parse("2026-08-11T12:00:00Z");
  const workflowRuns = [
    {
      id: 1,
      name: "CI - dev pull request",
      conclusion: "success",
      created_at: "2026-08-10T10:00:00Z",
      updated_at: "2026-08-10T10:02:00Z",
      run_attempt: 1,
    },
    {
      id: 2,
      name: "CI - dev pull request",
      conclusion: "failure",
      created_at: "2026-08-10T11:00:00Z",
      updated_at: "2026-08-10T11:04:00Z",
      run_attempt: 2,
    },
    {
      id: 3,
      name: "CI - release",
      conclusion: "cancelled",
      created_at: "2026-08-09T09:00:00Z",
      updated_at: "2026-08-09T09:05:00Z",
      run_attempt: 1,
    },
    {
      id: 4,
      name: "Manual validation",
      conclusion: "failure",
      created_at: "2026-08-10T08:00:00Z",
      updated_at: "2026-08-10T08:03:00Z",
      run_attempt: 1,
    },
    {
      id: 5,
      name: "CI - release",
      conclusion: "failure",
      created_at: "2026-08-04T11:59:59Z",
      updated_at: "2026-08-04T12:01:00Z",
      run_attempt: 1,
    },
  ];
  const jobs = [
    { name: "Dev lint and build", conclusion: "failure" },
    { name: "Dev functional tests", conclusion: "timed_out" },
    { name: "CI dev gate", conclusion: "skipped" },
  ];
  const github = {
    rest: {
      actions: {
        listWorkflowRunsForRepo,
        listJobsForWorkflowRun,
      },
    },
    async paginate(endpoint, parameters) {
      calls.push({ endpoint, parameters });
      if (endpoint === listWorkflowRunsForRepo) return workflowRuns;
      assert.equal(endpoint, listJobsForWorkflowRun);
      assert.equal(parameters.run_id, 2);
      return jobs;
    },
  };

  await runCiMetrics({
    github,
    context: { repo: { owner: "matpilates", repo: "mat-pilates" } },
    core: { summary },
    now,
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].parameters.created, ">=2026-08-04");
  assert.deepEqual(summary.tables[0].slice(1), [
    ["CI - dev pull request", "2", "2 min", "4 min", "1", "0", "50%"],
    ["CI - release", "1", "5 min", "5 min", "0", "1", "0%"],
  ]);
  assert.deepEqual(summary.tables[1].slice(1), [
    ["Dev lint and build", "1"],
    ["Dev functional tests", "1"],
  ]);
  assert.equal(summary.writes, 1);
});

test("reports an empty measured period without querying jobs", async () => {
  const listWorkflowRunsForRepo = Symbol("listWorkflowRunsForRepo");
  const listJobsForWorkflowRun = Symbol("listJobsForWorkflowRun");
  const summary = createSummary();
  const github = {
    rest: {
      actions: {
        listWorkflowRunsForRepo,
        listJobsForWorkflowRun,
      },
    },
    async paginate(endpoint) {
      assert.equal(endpoint, listWorkflowRunsForRepo);
      return [];
    },
  };

  await runCiMetrics({
    github,
    context: { repo: { owner: "matpilates", repo: "mat-pilates" } },
    core: { summary },
    now: Date.parse("2026-08-11T12:00:00Z"),
  });

  assert.deepEqual(summary.tables[0].slice(1), [
    ["CI - dev pull request", "0", "0 min", "0 min", "0", "0", "0%"],
    ["CI - release", "0", "0 min", "0 min", "0", "0", "0%"],
  ]);
  assert.match(summary.raws.join(""), /No failed jobs/);
  assert.equal(summary.writes, 1);
});

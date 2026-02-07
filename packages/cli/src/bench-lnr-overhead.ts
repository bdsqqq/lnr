#!/usr/bin/env bun

/**
 * measures per-call cost breakdown of lnr e2e subprocess invocations.
 *
 * the e2e tests spawn `bun run dev -- <args>` for every assertion (~50 calls).
 * this script isolates where time goes: bun startup, module loading, API latency.
 * use it to evaluate whether optimization ideas (compiling, parallelizing, calling
 * core directly) are worth the complexity.
 *
 * run:   bun run packages/cli/src/bench-lnr-overhead.ts
 * needs: LINEAR_API_KEY set (for API-hitting measurements)
 *
 * baseline results (2026-02-07, macOS arm64, bun 1.3.5):
 *
 *   bare subprocess (bun --version):        5ms
 *   bun run dev -- --help (no API):       302ms   ← module loading dominates
 *   compiled binary --help (no API):      263ms   ← only 38ms faster
 *   bun run dev -- me (with API):         629ms
 *   compiled binary me (with API):        533ms
 *
 *   API latency (derived):               ~300ms   ← irreducible
 *   savings from compiling (40 calls):    ~1.5s   ← not worth it
 *
 * CI end-to-end (2026-02-07, ubuntu github actions runner):
 *   readonly tests:   6s (10 tests)
 *   mutation tests:  42s (32 tests, 40 subprocess calls)
 *   per-test mean:   ~1.3s (range: 575ms to 4000ms)
 *
 * conclusion: the bottleneck is sequential API round-trips (~300ms each
 * on CI), not subprocess startup. parallelizing independent test groups
 * is the only approach that meaningfully reduces total time.
 */

const ITERATIONS = 5;
const cliDir = import.meta.dir + "/../..";
const cliPkgDir = import.meta.dir + "/..";
const BUN = process.execPath;

interface TimingResult {
  label: string;
  times: number[];
  mean: number;
  min: number;
  max: number;
}

function stats(label: string, times: number[]): TimingResult {
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  return { label, times, mean, min: Math.min(...times), max: Math.max(...times) };
}

function report(r: TimingResult) {
  console.log(`  ${r.label}: mean=${r.mean.toFixed(0)}ms  min=${r.min.toFixed(0)}ms  max=${r.max.toFixed(0)}ms  (n=${r.times.length})`);
}

async function timeLnrDev(...args: string[]): Promise<number> {
  const start = performance.now();
  const proc = Bun.spawn([BUN, "run", "dev", "--", ...args], {
    cwd: cliDir,
    stdout: "pipe",
    stderr: "pipe",
  });
  await new Response(proc.stdout).text();
  await proc.exited;
  return performance.now() - start;
}

async function timeLnrCompiled(...args: string[]): Promise<number> {
  const start = performance.now();
  const proc = Bun.spawn(["/tmp/lnr-bench", ...args], {
    cwd: cliDir,
    stdout: "pipe",
    stderr: "pipe",
  });
  await new Response(proc.stdout).text();
  await proc.exited;
  return performance.now() - start;
}

async function timeBareSubprocess(): Promise<number> {
  const start = performance.now();
  const proc = Bun.spawn([BUN, "--version"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  await new Response(proc.stdout).text();
  await proc.exited;
  return performance.now() - start;
}

// --- run ---

console.log("=== lnr subprocess overhead benchmark ===\n");

console.log("1. bare `bun --version` (subprocess overhead floor)");
const bareTimes: number[] = [];
for (let i = 0; i < ITERATIONS; i++) {
  bareTimes.push(await timeBareSubprocess());
}
report(stats("bun --version", bareTimes));

console.log("\n2. `bun run dev -- --help` (startup + module loading, no API)");
const helpTimes: number[] = [];
for (let i = 0; i < ITERATIONS; i++) {
  helpTimes.push(await timeLnrDev("--help"));
}
report(stats("lnr --help (dev)", helpTimes));

console.log("\n3. compiling binary...");
const compileStart = performance.now();
const compileProc = Bun.spawn([BUN, "build", "./src/cli.ts", "--compile", "--outfile", "/tmp/lnr-bench"], {
  cwd: cliPkgDir,
  stdout: "pipe",
  stderr: "pipe",
});
const compileStderr = await new Response(compileProc.stderr).text();
const compileExit = await compileProc.exited;
console.log(`   compiled in ${(performance.now() - compileStart).toFixed(0)}ms (exit: ${compileExit})`);
if (compileExit !== 0) {
  console.log(`   compile failed: ${compileStderr}`);
  process.exit(1);
}

console.log("\n4. `/tmp/lnr-bench --help` (compiled binary, no API)");
const compiledHelpTimes: number[] = [];
for (let i = 0; i < ITERATIONS; i++) {
  compiledHelpTimes.push(await timeLnrCompiled("--help"));
}
report(stats("lnr --help (compiled)", compiledHelpTimes));

console.log("\n5. `bun run dev -- me` (dev mode, hits Linear API)");
const meTimes: number[] = [];
for (let i = 0; i < ITERATIONS; i++) {
  meTimes.push(await timeLnrDev("me"));
}
report(stats("lnr me (dev)", meTimes));

console.log("\n6. `/tmp/lnr-bench me` (compiled, hits Linear API)");
const meCompiledTimes: number[] = [];
for (let i = 0; i < ITERATIONS; i++) {
  meCompiledTimes.push(await timeLnrCompiled("me"));
}
report(stats("lnr me (compiled)", meCompiledTimes));

const devOverhead = stats("lnr --help (dev)", helpTimes).mean;
const devWithApi = stats("lnr me (dev)", meTimes).mean;
const compiledOverhead = stats("lnr --help (compiled)", compiledHelpTimes).mean;
const compiledWithApi = stats("lnr me (compiled)", meCompiledTimes).mean;

console.log("\n=== derived ===");
console.log(`  dev startup overhead (no API):     ${devOverhead.toFixed(0)}ms`);
console.log(`  compiled startup overhead (no API): ${compiledOverhead.toFixed(0)}ms`);
console.log(`  savings per call (compiled):        ${(devOverhead - compiledOverhead).toFixed(0)}ms`);
console.log(`  estimated API latency (dev):        ${(devWithApi - devOverhead).toFixed(0)}ms`);
console.log(`  estimated API latency (compiled):   ${(compiledWithApi - compiledOverhead).toFixed(0)}ms`);
console.log(`  total lnr calls in mutations e2e:   40`);
console.log(`  estimated savings (40 calls):        ${((devOverhead - compiledOverhead) * 40 / 1000).toFixed(1)}s`);

console.log("\ndone.");

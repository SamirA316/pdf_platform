import { spawn } from "child_process";
import path from "path";

interface ISuiteResult {
  name: string;
  file: string;
  durationMs: number;
  passed: boolean;
  summary: string;
}

const PHASE4_SUITES = [
  { name: "Phase 4.1 Merge PDF", file: "phase4_merge.test.ts" },
  { name: "Phase 4.2 Split PDF", file: "phase4_split.test.ts" },
  { name: "Phase 4.3 Rotate PDF", file: "phase4_rotate.test.ts" },
  { name: "Phase 4.4 Organize PDF", file: "phase4_organize.test.ts" },
  { name: "Phase 4.5 Resize PDF", file: "phase4_resize.test.ts" },
  { name: "Phase 4.6 Watermark PDF", file: "phase4_watermark.test.ts" },
  { name: "Phase 4.7 Page Numbers", file: "phase4_page_numbers.test.ts" },
  { name: "Phase 4.8 & 4.9 Protect & Unlock", file: "phase4_protect_unlock.test.ts" },
  { name: "Phase 4.10 Repair PDF", file: "phase4_repair.test.ts" },
  { name: "Phase 4.11 PDF to PDF/A", file: "phase4_pdfa.test.ts" },
];

async function runSuite(suite: { name: string; file: string }): Promise<ISuiteResult> {
  const filePath = path.resolve(__dirname, suite.file);
  const start = Date.now();

  return new Promise((resolve) => {
    console.log(`\n===============================================================`);
    console.log(`▶ RUNNING: ${suite.name} (${suite.file})`);
    console.log(`===============================================================`);

    const proc = spawn("npx", ["tsx", filePath], {
      cwd: path.resolve(__dirname, ".."),
      stdio: "inherit",
      env: { ...process.env, NODE_ENV: "test" },
    });

    proc.on("error", (err) => {
      const durationMs = Date.now() - start;
      resolve({
        name: suite.name,
        file: suite.file,
        durationMs,
        passed: false,
        summary: `Execution error: ${err.message}`,
      });
    });

    proc.on("close", (code) => {
      const durationMs = Date.now() - start;
      const passed = code === 0;
      resolve({
        name: suite.name,
        file: suite.file,
        durationMs,
        passed,
        summary: passed ? "100% Passed" : `Exited with code ${code}`,
      });
    });
  });
}

async function main() {
  console.log(`\n===============================================================`);
  console.log(`       QUICKPDF PLATFORM - PHASE 4 FULL TEST SUITE RUNNER       `);
  console.log(`===============================================================`);
  console.log(`Total Suites: ${PHASE4_SUITES.length}`);
  const overallStart = Date.now();

  const results: ISuiteResult[] = [];

  for (const suite of PHASE4_SUITES) {
    const res = await runSuite(suite);
    results.push(res);
  }

  const overallDuration = ((Date.now() - overallStart) / 1000).toFixed(2);
  const allPassed = results.every((r) => r.passed);
  const passedCount = results.filter((r) => r.passed).length;

  console.log(`\n\n===============================================================`);
  console.log(`              PHASE 4 CONSOLIDATED TEST SUMMARY                `);
  console.log(`===============================================================`);
  console.log(`Status   | Duration | Suite Name                      | File`);
  console.log(`---------+----------+---------------------------------+---------------------------`);

  for (const r of results) {
    const status = r.passed ? "✅ PASS" : "❌ FAIL";
    const dur = `${(r.durationMs / 1000).toFixed(2)}s`.padStart(8, " ");
    const name = r.name.padEnd(31, " ");
    console.log(`${status}  | ${dur} | ${name} | ${r.file}`);
  }

  console.log(`---------+----------+---------------------------------+---------------------------`);
  console.log(`Overall: ${passedCount}/${results.length} suites passed (${overallDuration}s total)`);

  if (!allPassed) {
    console.error(`\n❌ Some Phase 4 suites failed.`);
    process.exit(1);
  } else {
    console.log(`\n🎉 All Phase 4 test suites passed successfully! (100% Coverage)`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});

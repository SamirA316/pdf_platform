import { spawn } from "child_process";
import path from "path";

interface ISuiteResult {
  phase: string;
  name: string;
  file: string;
  durationMs: number;
  passed: boolean;
}

const REGRESSION_SUITES = [
  { phase: "Phase 2 (Auth)", name: "Authentication & User Security", file: "phase2_auth.test.ts" },
  { phase: "Phase 2.4B (Sessions)", name: "Session Management & Password Change", file: "phase2_4b_sessions.test.ts" },
  { phase: "Phase 2.4C (Hardening)", name: "Authentication Hardening (CSRF, Rate Limiting & Cookies)", file: "phase2_4c_hardening.test.ts" },
  { phase: "Phase 2.5A (Profile)", name: "User Profile Read & Update", file: "phase2_5a_profile.test.ts" },
  { phase: "Phase 2.5B (Email Change)", name: "Secure Email Change (OTP & Session Revocation)", file: "phase2_5b_email_change.test.ts" },
  { phase: "Phase 2.5C (Deactivation & Deletion)", name: "Account Deactivation & Permanent Deletion", file: "phase2_5c_deactivation_deletion.test.ts" },
  { phase: "Phase 2.5D (Security Events)", name: "Security Event Recording, Activity API & Privacy", file: "phase2_5d_security_events.test.ts" },
  { phase: "Phase 2 (Files)", name: "File Management & Security", file: "phase2_files.test.ts" },
  { phase: "Phase 2.6A (Ownership)", name: "File Ownership & Access Control (IDOR & Storage)", file: "phase2_6a_file_ownership.test.ts" },
  { phase: "Phase 2.6B (Listing)", name: "File Listing, Pagination, Sorting & Public Metadata", file: "phase2_6b_file_listing.test.ts" },
  { phase: "Phase 2.6C (Download)", name: "File Download & Preview Security (Auth, Headers & Storage)", file: "phase2_6c_file_download.test.ts" },
  { phase: "Phase 2.6D (Delete)", name: "File Delete & 2-Phase Lifecycle Consistency", file: "phase2_6d_file_delete.test.ts" },
  { phase: "Phase 2.6E (Quotas)", name: "Storage Quotas, Limits & Abuse Protection", file: "phase2_6e_storage_quota.test.ts" },
  { phase: "Phase 2.6F (Audit)", name: "Final Regression & Security Audit Matrix", file: "phase2_6f_final_regression_audit.test.ts" },
  { phase: "Phase 3", name: "Job State Machine & Processing Engine", file: "phase3_jobs.test.ts" },
  { phase: "Phase 4", name: "PDF Core Tools (Merge, Split, Rotate, Organize, Resize, Watermark, Page Numbers, Protect, Unlock, Repair, PDF/A)", file: "phase4_all.ts" },
  { phase: "Phase 5.1", name: "PDF Editor Foundation (Math, Schemas, State & Contracts)", file: "phase5_editor_foundation.test.ts" },
  { phase: "Phase 5.2", name: "PDF Viewer & Rendering (High-DPI, Cancellation & Thumbnails)", file: "phase5_editor_viewer.test.ts" },
  { phase: "Phase 5.3", name: "Page Navigation & Thumbnails (Bi-directional Scroll Sync & Jump)", file: "phase5_editor_navigation.test.ts" },
  { phase: "Phase 5.4", name: "Zoom, Pan & Page Rotation (Presets, Hand Tool & View Angle)", file: "phase5_editor_zoom_pan_rotate.test.ts" },
  { phase: "Phase 5.5.1", name: "Text Object Model & State Architecture (Validation, Invariants & Manifest)", file: "phase5_editor_text_model.test.ts" },
  { phase: "Phase 5.5.2", name: "Text Box Creation & Input (Drag, Minimums, Inversion & Inline Editing)", file: "phase5_editor_text_box.test.ts" },
  { phase: "Phase 5.5.3", name: "Text Box Resizing & Bounding Handles (4-Corner Drag, Inversion & History)", file: "phase5_editor_resize.test.ts" },
  { phase: "Phase 5.5.4", name: "Text Object Move / Drag (Grab Offset, Boundaries & Atomic Move)", file: "phase5_editor_move.test.ts" },
  { phase: "Phase 5.5.5", name: "Text Formatting (Fonts, Sizing, Toggles, Color, Alignment, Line Height & Undo)", file: "phase5_editor_format.test.ts" },
  { phase: "Phase 5.5.6", name: "Text Object Rotation (Handle, Center Math, Normalization & History)", file: "phase5_editor_rotate.test.ts" },
  { phase: "Phase 6", name: "Production STORAGE_ROOT Security Enforcement", file: "phase6_storage_root.test.ts" },
  { phase: "Phase 7", name: "Durable Worker Restart & Crash Recovery Verification", file: "worker_restart.test.ts" },
];

async function runStep(suite: { phase: string; name: string; file: string }): Promise<ISuiteResult> {
  const filePath = path.resolve(__dirname, suite.file);
  const start = Date.now();

  return new Promise((resolve) => {
    console.log(`\n===============================================================`);
    console.log(`▶ [REGRESSION] Running ${suite.phase}: ${suite.name}`);
    console.log(`===============================================================`);

    const proc = spawn("npx", ["tsx", filePath], {
      cwd: path.resolve(__dirname, ".."),
      stdio: "inherit",
      env: { ...process.env, NODE_ENV: "test" },
    });

    proc.on("error", () => {
      resolve({
        phase: suite.phase,
        name: suite.name,
        file: suite.file,
        durationMs: Date.now() - start,
        passed: false,
      });
    });

    proc.on("close", (code) => {
      resolve({
        phase: suite.phase,
        name: suite.name,
        file: suite.file,
        durationMs: Date.now() - start,
        passed: code === 0,
      });
    });
  });
}

async function main() {
  console.log(`\n===============================================================`);
  console.log(`        QUICKPDF PLATFORM - FULL REGRESSION TEST SUITE         `);
  console.log(`===============================================================`);
  const overallStart = Date.now();
  const results: ISuiteResult[] = [];

  for (const suite of REGRESSION_SUITES) {
    const res = await runStep(suite);
    results.push(res);
  }

  const overallDuration = ((Date.now() - overallStart) / 1000).toFixed(2);
  const allPassed = results.every((r) => r.passed);

  console.log(`\n\n===============================================================`);
  console.log(`                 REGRESSION SUITE SUMMARY                      `);
  console.log(`===============================================================`);
  for (const r of results) {
    const status = r.passed ? "✅ PASS" : "❌ FAIL";
    const dur = `${(r.durationMs / 1000).toFixed(2)}s`.padStart(8, " ");
    console.log(`${status} | ${dur} | ${r.phase}: ${r.name}`);
  }
  console.log(`===============================================================`);
  console.log(`Total Duration: ${overallDuration}s`);

  if (!allPassed) {
    console.error(`\n❌ Regression test suite encountered failures.`);
    process.exit(1);
  } else {
    console.log(`\n🎉 Full regression test suite passed! All operational modules verified.`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Regression runner fatal error:", err);
  process.exit(1);
});

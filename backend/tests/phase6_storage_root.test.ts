process.env.NODE_ENV = "test";
import assert from "assert";
import path from "path";
import { StorageService } from "../src/modules/files/storage.service";

async function runStorageRootTests() {
  console.log("===============================================================");
  console.log("▶ [TEST] Phase 6: Production STORAGE_ROOT Security Enforcement");
  console.log("===============================================================");

  const originalEnv = { ...process.env };
  const storageService = new StorageService();

  try {
    // Test 1: Missing STORAGE_ROOT in production triggers fatal exception
    process.env.NODE_ENV = "production";
    delete process.env.STORAGE_ROOT;
    let err1: Error | null = null;
    try {
      storageService.getStorageRoot();
    } catch (e: any) {
      err1 = e;
    }
    assert(err1 !== null, "Expected missing STORAGE_ROOT in production to throw");
    assert(
      err1.message.includes("FATAL: STORAGE_ROOT environment variable is mandatory in production"),
      `Unexpected error message: ${err1.message}`
    );
    console.log("✅ [PASS] Test 1: Missing STORAGE_ROOT in production halts fatally");

    // Test 2: Empty/whitespace STORAGE_ROOT in production triggers fatal exception
    process.env.NODE_ENV = "production";
    process.env.STORAGE_ROOT = "   ";
    let err2: Error | null = null;
    try {
      storageService.getStorageRoot();
    } catch (e: any) {
      err2 = e;
    }
    assert(err2 !== null, "Expected whitespace STORAGE_ROOT in production to throw");
    assert(
      err2.message.includes("FATAL: STORAGE_ROOT environment variable is mandatory in production"),
      `Unexpected error message: ${err2.message}`
    );
    console.log("✅ [PASS] Test 2: Empty/whitespace STORAGE_ROOT in production halts fatally");

    // Test 3: Relative STORAGE_ROOT in production is rejected
    process.env.NODE_ENV = "production";
    process.env.STORAGE_ROOT = "./relative/uploads/path";
    let err3: Error | null = null;
    try {
      storageService.getStorageRoot();
    } catch (e: any) {
      err3 = e;
    }
    assert(err3 !== null, "Expected relative STORAGE_ROOT in production to throw");
    assert(
      err3.message.includes("FATAL: STORAGE_ROOT must be an absolute path in production"),
      `Unexpected error message: ${err3.message}`
    );
    console.log("✅ [PASS] Test 3: Relative STORAGE_ROOT in production is strictly rejected");

    // Test 4: Absolute STORAGE_ROOT in production succeeds
    process.env.NODE_ENV = "production";
    process.env.STORAGE_ROOT = "/var/lib/quickpdf/uploads";
    const resolvedProd = storageService.getStorageRoot();
    assert.strictEqual(resolvedProd, "/var/lib/quickpdf/uploads");
    console.log("✅ [PASS] Test 4: Absolute STORAGE_ROOT in production is successfully accepted");

    // Test 5: Safe local fallback in non-production environments
    process.env.NODE_ENV = "development";
    delete process.env.STORAGE_ROOT;
    const resolvedDev = storageService.getStorageRoot();
    assert.strictEqual(resolvedDev, path.resolve(process.cwd(), "uploads"));
    console.log("✅ [PASS] Test 5: Development safely falls back to local uploads directory");

    console.log("===============================================================");
    console.log("🎉 All Phase 6 STORAGE_ROOT Security Tests Passed (5/5)!");
    console.log("===============================================================");
  } finally {
    process.env = originalEnv;
  }
}

runStorageRootTests().catch((err) => {
  console.error("❌ Phase 6 Tests Failed:", err);
  process.exit(1);
});

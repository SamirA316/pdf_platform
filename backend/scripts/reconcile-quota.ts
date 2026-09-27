/**
 * Quota Reconciliation Maintenance Script (Launch Plan Item 23)
 * Scans all active users and reconciles StorageQuota.usedBytes with actual SUM(File.size)
 */

import { prisma } from "../src/common/prisma";
import { filesService } from "../src/modules/files/files.service";

async function main() {
  console.log("=== QuickPDF Storage Quota Reconciliation Job ===");
  const startTime = Date.now();

  const users = await prisma.user.findMany({
    select: { id: true, email: true },
  });

  console.log(`Found ${users.length} users to inspect.`);
  let reconciledCount = 0;

  for (const user of users) {
    try {
      const prevQuota = await prisma.storageQuota.findUnique({
        where: { userId: user.id },
      });
      const previousUsage = prevQuota ? prevQuota.usedBytes : 0;

      const syncedUsage = await filesService.syncQuotaWithActiveFiles(user.id);

      if (previousUsage !== syncedUsage) {
        console.log(
          `[FIXED] User ${user.email} (${user.id}): Reconciled usage drift: ${previousUsage} -> ${syncedUsage} bytes`
        );
        reconciledCount++;
      }
    } catch (err: any) {
      console.error(`[ERROR] Failed to reconcile user ${user.id}:`, err.message || err);
    }
  }

  const duration = Date.now() - startTime;
  console.log(`✅ Quota reconciliation complete. Checked: ${users.length}, Drift repaired: ${reconciledCount} in ${duration}ms.`);
}

main()
  .catch((err) => {
    console.error("Fatal error running quota reconciliation:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

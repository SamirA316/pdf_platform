-- CreateTable
CREATE TABLE "EmailChangeRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "newEmail" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSentAt" DATETIME,
    CONSTRAINT "EmailChangeRequest_userId_fkey"
        FOREIGN KEY ("userId")
        REFERENCES "User" ("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "EmailChangeRequest_userId_idx"
ON "EmailChangeRequest"("userId");

-- CreateIndex
CREATE INDEX "EmailChangeRequest_expiresAt_idx"
ON "EmailChangeRequest"("expiresAt");

-- CreateIndex
CREATE INDEX "EmailChangeRequest_newEmail_idx"
ON "EmailChangeRequest"("newEmail");

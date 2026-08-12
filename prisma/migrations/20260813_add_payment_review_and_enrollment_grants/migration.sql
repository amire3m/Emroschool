ALTER TABLE "PaymentOrder" ADD COLUMN "reviewVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "PaymentReviewDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "reviewVersion" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orderId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    CONSTRAINT "PaymentReviewDecision_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PaymentOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "EnrollmentGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL
);

CREATE UNIQUE INDEX "PaymentReviewDecision_orderId_reviewVersion_key" ON "PaymentReviewDecision"("orderId", "reviewVersion");
CREATE INDEX "PaymentReviewDecision_orderId_createdAt_idx" ON "PaymentReviewDecision"("orderId", "createdAt");
CREATE UNIQUE INDEX "EnrollmentGrant_sourceType_sourceId_key" ON "EnrollmentGrant"("sourceType", "sourceId");
CREATE INDEX "EnrollmentGrant_userId_courseId_active_idx" ON "EnrollmentGrant"("userId", "courseId", "active");

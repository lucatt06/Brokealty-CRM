-- CreateTable
CREATE TABLE "bro_messages" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "drafts" JSONB,
    "actions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bro_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bro_messages_leadId_userId_createdAt_idx" ON "bro_messages"("leadId", "userId", "createdAt");

-- AddForeignKey
ALTER TABLE "bro_messages" ADD CONSTRAINT "bro_messages_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

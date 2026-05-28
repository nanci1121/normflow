-- CreateTable
CREATE TABLE "ApprovalWorkflow" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalWorkflowStep" (
    "id" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "responsibility" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workflowId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,

    CONSTRAINT "ApprovalWorkflowStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalWorkflow_category_key" ON "ApprovalWorkflow"("category");

-- CreateIndex
CREATE INDEX "ApprovalWorkflowStep_workflowId_idx" ON "ApprovalWorkflowStep"("workflowId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalWorkflowStep_workflowId_stepOrder_key" ON "ApprovalWorkflowStep"("workflowId", "stepOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalWorkflowStep_workflowId_approverId_key" ON "ApprovalWorkflowStep"("workflowId", "approverId");

-- AddForeignKey
ALTER TABLE "ApprovalWorkflowStep" ADD CONSTRAINT "ApprovalWorkflowStep_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "ApprovalWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalWorkflowStep" ADD CONSTRAINT "ApprovalWorkflowStep_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

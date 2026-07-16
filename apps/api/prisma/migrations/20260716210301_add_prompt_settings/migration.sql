-- CreateTable
CREATE TABLE "PromptSetting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "summarySystemPrompt" TEXT NOT NULL,
    "quizSystemPrompt" TEXT NOT NULL,
    "tutorSystemPrompt" TEXT NOT NULL,
    "visualSystemPrompt" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelRouterSetting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "providerOrder" TEXT[],
    "disabledProviders" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelRouterSetting_pkey" PRIMARY KEY ("id")
);

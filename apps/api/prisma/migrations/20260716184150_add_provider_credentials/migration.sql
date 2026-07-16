-- CreateTable
CREATE TABLE "ProviderCredential" (
    "name" TEXT NOT NULL,
    "apiKeyEnc" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderCredential_pkey" PRIMARY KEY ("name")
);

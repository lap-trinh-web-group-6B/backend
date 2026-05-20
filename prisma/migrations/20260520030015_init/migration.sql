-- CreateEnum
CREATE TYPE "budgets_result_status_enum" AS ENUM ('UNDER_BUDGET', 'EXACT', 'OVER_BUDGET');

-- CreateEnum
CREATE TYPE "budgets_status_enum" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "categories_status_enum" AS ENUM ('ACTIVATE', 'DISABLED');

-- CreateEnum
CREATE TYPE "categories_type_enum" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "notifications_status_enum" AS ENUM ('ACTIVE', 'DELETED');

-- CreateEnum
CREATE TYPE "notifications_type_enum" AS ENUM ('WARNING', 'REMINDER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "orders_status_enum" AS ENUM ('pending', 'success', 'failed');

-- CreateEnum
CREATE TYPE "transactions_source_enum" AS ENUM ('MANUAL', 'OCR_SCAN');

-- CreateEnum
CREATE TYPE "transactions_status_enum" AS ENUM ('ACTIVATE', 'DISABLED');

-- CreateEnum
CREATE TYPE "users_status_enum" AS ENUM ('ACTIVATE', 'DISABLE', 'BANNED', 'CANCEL');

-- CreateEnum
CREATE TYPE "users_type_enum" AS ENUM ('FREE', 'PREMIUM');

-- CreateEnum
CREATE TYPE "wallets_status_enum" AS ENUM ('ACTIVATE', 'DISABLED');

-- CreateEnum
CREATE TYPE "wallets_type_enum" AS ENUM ('CASH', 'BANK_ACCOUNT', 'E_WALLET');

-- CreateTable
CREATE TABLE "budgets" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "amount_limit" DECIMAL(18,2) NOT NULL,
    "start_date" TIMESTAMP(6) NOT NULL,
    "end_date" TIMESTAMP(6) NOT NULL,
    "status" "budgets_status_enum" NOT NULL DEFAULT 'ACTIVE',
    "final_spent_amount" DECIMAL(18,2),
    "result_status" "budgets_result_status_enum",
    "is_alert_enabled" BOOLEAN NOT NULL DEFAULT true,
    "alert_threshold" DECIMAL(3,2) NOT NULL DEFAULT 0.8,
    "completion_date" TIMESTAMP(6),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "name" VARCHAR NOT NULL,
    "name_normalized" VARCHAR NOT NULL,
    "type" "categories_type_enum" NOT NULL DEFAULT 'EXPENSE',
    "icon_url" VARCHAR,
    "status" "categories_status_enum" NOT NULL DEFAULT 'ACTIVATE',
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "title" VARCHAR NOT NULL,
    "message" TEXT NOT NULL,
    "type" "notifications_type_enum" NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "status" "notifications_status_enum" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "orderCode" VARCHAR(8) NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "orders_status_enum" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otps" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR NOT NULL,
    "otp" VARCHAR(6) NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "wallet_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "note" TEXT,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR NOT NULL DEFAULT 'VND',
    "source" "transactions_source_enum" NOT NULL DEFAULT 'MANUAL',
    "receipt_image_url" VARCHAR,
    "status" "transactions_status_enum" NOT NULL DEFAULT 'ACTIVATE',
    "transaction_date" TIMESTAMP(6) NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR NOT NULL,
    "password" VARCHAR NOT NULL,
    "syncId" VARCHAR,
    "avatar" VARCHAR,
    "fullName" VARCHAR NOT NULL,
    "fcmToken" VARCHAR,
    "type" "users_type_enum" NOT NULL DEFAULT 'FREE',
    "status" "users_status_enum" NOT NULL DEFAULT 'ACTIVATE',
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" VARCHAR NOT NULL,
    "balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR NOT NULL DEFAULT 'VND',
    "type" "wallets_type_enum" NOT NULL,
    "status" "wallets_status_enum" NOT NULL DEFAULT 'ACTIVATE',
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_name_key" ON "wallets"("user_id", "name");

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "FK_0b171330be0cb621f8d73b87a9e" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "FK_c9e41213ca42d50132ed7ab2b0f" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "FK_e9acc6efa76de013e8c1553ed2b" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "FK_92558c08091598f7a4439586cda" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

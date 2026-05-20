/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- RenameForeignKey
ALTER TABLE "transactions" RENAME CONSTRAINT "FK_0b171330be0cb621f8d73b87a9e" TO "transactions_wallet_id_fkey";

-- RenameForeignKey
ALTER TABLE "transactions" RENAME CONSTRAINT "FK_c9e41213ca42d50132ed7ab2b0f" TO "transactions_category_id_fkey";

-- RenameForeignKey
ALTER TABLE "transactions" RENAME CONSTRAINT "FK_e9acc6efa76de013e8c1553ed2b" TO "transactions_user_id_fkey";

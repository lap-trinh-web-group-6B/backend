-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "transfer_wallet_id" INTEGER;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_transfer_wallet_id_fkey" FOREIGN KEY ("transfer_wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

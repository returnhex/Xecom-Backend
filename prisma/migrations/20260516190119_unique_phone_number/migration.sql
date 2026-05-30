/*
  Warnings:

  - You are about to drop the column `addressType` on the `addresses` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[phoneNumber]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "addresses" DROP COLUMN "addressType",
ADD COLUMN     "isDefault" BOOLEAN;

-- DropEnum
DROP TYPE "AddressType";

-- CreateIndex
CREATE UNIQUE INDEX "users_phoneNumber_key" ON "users"("phoneNumber");

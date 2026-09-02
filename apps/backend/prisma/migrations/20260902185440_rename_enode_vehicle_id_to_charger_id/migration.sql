/*
  Warnings:

  - You are about to drop the column `enodeVehicleId` on the `Charger` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Charger" DROP COLUMN "enodeVehicleId",
ADD COLUMN     "enodeChargerId" TEXT;

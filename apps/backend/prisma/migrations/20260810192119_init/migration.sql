-- CreateEnum
CREATE TYPE "CableType" AS ENUM ('TETHERED', 'BRING_YOUR_OWN');

-- CreateEnum
CREATE TYPE "ConnectionRoute" AS ENUM ('OCPP', 'ENODE');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "SessionEndedReason" AS ENUM ('DRIVER_ENDED', 'RELEASED_EARLY', 'SYSTEM_TIMEOUT');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('ENERGY', 'IDLE_OCCUPANCY', 'OVERSTAY', 'SERVICE_CHARGE', 'NO_SHOW_FEE');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "stripeCustomerId" TEXT,
    "stripeConnectAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Charger" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "postcode" TEXT NOT NULL,
    "fullAddress" TEXT,
    "title" TEXT NOT NULL,
    "listingName" TEXT,
    "powerKw" DOUBLE PRECISION NOT NULL,
    "cable" "CableType" NOT NULL,
    "connector" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "overstayRate" DOUBLE PRECISION NOT NULL,
    "idleRate" DOUBLE PRECISION NOT NULL,
    "noShowFee" DOUBLE PRECISION NOT NULL,
    "hostCost" DOUBLE PRECISION,
    "connectionRoute" "ConnectionRoute" NOT NULL,
    "ocppChargePointId" TEXT,
    "enodeVehicleId" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "Charger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" SERIAL NOT NULL,
    "driverId" INTEGER NOT NULL,
    "chargerId" INTEGER NOT NULL,
    "arrivalAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'UPCOMING',
    "serviceChargePaid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "meterStartKwh" DOUBLE PRECISION NOT NULL,
    "meterEndKwh" DOUBLE PRECISION,
    "idleStartedAt" TIMESTAMP(3),
    "energyCost" DOUBLE PRECISION,
    "idleCost" DOUBLE PRECISION,
    "overstayCost" DOUBLE PRECISION,
    "endedReason" "SessionEndedReason",

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "type" "TransactionType" NOT NULL,
    "grossAmount" DOUBLE PRECISION NOT NULL,
    "commissionAmount" DOUBLE PRECISION NOT NULL,
    "hostNetAmount" DOUBLE PRECISION NOT NULL,
    "stripePaymentIntentId" TEXT,
    "stripeTransferId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_bookingId_key" ON "Session"("bookingId");

-- AddForeignKey
ALTER TABLE "Charger" ADD CONSTRAINT "Charger_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_chargerId_fkey" FOREIGN KEY ("chargerId") REFERENCES "Charger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

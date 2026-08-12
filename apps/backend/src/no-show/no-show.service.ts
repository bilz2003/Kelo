import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Interval } from "@nestjs/schedule";
import { BookingStatus, TransactionType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

// Checked every 30s — the default 20-minute grace only needs to be caught
// within roughly that margin, and NO_SHOW_GRACE_MINUTES can be set to a
// fraction of a minute for testing without needing a faster sweep.
const SWEEP_INTERVAL_MS = 30_000;
const DEFAULT_GRACE_MINUTES = 20;

@Injectable()
export class NoShowService {
  private readonly logger = new Logger(NoShowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private graceMinutes(): number {
    const raw = this.config.get<string>("NO_SHOW_GRACE_MINUTES");
    const parsed = raw !== undefined ? Number(raw) : DEFAULT_GRACE_MINUTES;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_GRACE_MINUTES;
  }

  @Interval(SWEEP_INTERVAL_MS)
  async sweep(): Promise<void> {
    const cutoff = new Date(Date.now() - this.graceMinutes() * 60_000);

    const overdue = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.UPCOMING,
        session: null,
        arrivalAt: { lte: cutoff },
      },
      include: { charger: true },
    });

    for (const booking of overdue) {
      await this.markNoShow(booking);
    }
  }

  private async markNoShow(booking: { id: number; charger: { noShowFee: number } }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Guards against a driver starting a session in the gap between the
      // sweep's read above and this write — updateMany's own where clause
      // is what actually matters for the race, not the findMany filter.
      const result = await tx.booking.updateMany({
        where: { id: booking.id, status: BookingStatus.UPCOMING },
        data: { status: BookingStatus.NO_SHOW },
      });
      if (result.count === 0) return;

      await tx.transaction.create({
        data: {
          bookingId: booking.id,
          type: TransactionType.NO_SHOW_FEE,
          grossAmount: booking.charger.noShowFee,
          commissionAmount: 0, // 0% commission on no-show fees — goes entirely to the host
          hostNetAmount: booking.charger.noShowFee,
          // stripePaymentIntentId/stripeTransferId intentionally left null:
          // recorded but not yet processed. No real Stripe integration
          // exists anywhere in this app yet (BACKEND-PLAN.md step 3) — this
          // transaction is exactly as "pending" as every other one created
          // so far (energy/idle/overstay), not a special case.
        },
      });
    });

    this.logger.log(`Booking ${booking.id} marked NO_SHOW; £${booking.charger.noShowFee.toFixed(2)} fee recorded (unprocessed).`);
  }
}

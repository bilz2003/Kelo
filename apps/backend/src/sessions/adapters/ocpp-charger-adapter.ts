import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { OcppCentralSystem } from "../ocpp/ocpp-central-system";
import { ChargerAdapter, MeterState } from "./charger-adapter.interface";

/**
 * Real OCPP 1.6-J integration, backed by OcppCentralSystem — a genuine
 * WebSocket connection to a real (or, for local testing, simulated) charge
 * point, not simulated timing. See OCPP-INTEGRATION.md for the full
 * picture of what's proven and how.
 *
 * All the actual protocol/connection-state work lives in OcppCentralSystem;
 * this class's job is exactly what MockChargerAdapter's and
 * EnodeChargerAdapter's do — resolve a Charger/Session via Prisma, then
 * delegate.
 */
@Injectable()
export class OcppChargerAdapter implements ChargerAdapter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly centralSystem: OcppCentralSystem,
  ) {}

  async authorize(sessionId: number): Promise<void> {
    const session = await this.prisma.session.findUniqueOrThrow({
      where: { id: sessionId },
      include: { booking: { include: { charger: true } } },
    });
    const { charger, id: bookingId } = session.booking;
    const chargePointId = charger.ocppChargePointId;
    if (!chargePointId) {
      throw new BadRequestException(
        `Charger ${charger.id} has connectionRoute OCPP but no ocppChargePointId set — it isn't linked to a real charge point.`,
      );
    }

    await this.centralSystem.remoteStart(chargePointId, sessionId, this.buildIdTag(bookingId));
  }

  async stop(sessionId: number): Promise<MeterState> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { booking: { include: { charger: true } } },
    });
    const chargePointId = session?.booking.charger.ocppChargePointId;
    if (!chargePointId) {
      return { kwh: 0, seconds: 0 };
    }
    return this.centralSystem.remoteStop(chargePointId, sessionId);
  }

  async getMeterValue(chargerId: number): Promise<MeterState | null> {
    const charger = await this.prisma.charger.findUnique({ where: { id: chargerId } });
    if (!charger?.ocppChargePointId) return null;
    return this.centralSystem.getMeterValueByChargePoint(charger.ocppChargePointId);
  }

  /**
   * OCPP 1.6 idTags are capped at 20 characters by the spec — this fits
   * any realistic booking id with room to spare. Kelo mints this itself
   * (there's no local card-present flow here — see OcppCentralSystem's
   * Authorize handler), so it just needs to be a stable, recognisable
   * value, not looked up anywhere.
   */
  private buildIdTag(bookingId: number): string {
    return `KELO-${bookingId}`;
  }
}

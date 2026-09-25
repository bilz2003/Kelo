import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { BookingStatus, ConnectionRoute, Prisma } from "@prisma/client";
import { deriveIdleAndOverstayRates } from "@kelo/core";
import { PrismaService } from "../prisma/prisma.service";
import { GeocodingService } from "../geocoding/geocoding.service";
import { haversineMiles } from "../geocoding/haversine";
import { PhotosService } from "../photos/photos.service";
import { EnodeLinkService } from "./enode-link.service";
import { OcppOnboardingService } from "../sessions/ocpp/ocpp-onboarding.service";
import { DEFAULT_SEARCH_ORIGIN } from "./search-origin";
import { CreateChargerDto } from "./dto/create-charger.dto";
import { UpdateChargerDto } from "./dto/update-charger.dto";
import { DiscoverQueryDto } from "./dto/discover-query.dto";
import { StatsQueryDto } from "./dto/stats-query.dto";

/**
 * Fields safe to hand to anyone who isn't the charger's owner or a driver
 * with a real booking on it. fullAddress and hostCost are deliberately
 * never in this list — GET /chargers/discover selects exactly this shape,
 * nothing more, so there's no field to accidentally leak by adding one to
 * the Prisma model later and forgetting to re-check every call site.
 */
export const PUBLIC_CHARGER_SELECT = {
  id: true,
  ownerId: true,
  postcode: true,
  title: true,
  listingName: true,
  powerKw: true,
  cable: true,
  connector: true,
  rate: true,
  overstayRate: true,
  idleRate: true,
  noShowFee: true,
  connectionRoute: true,
  available: true,
  lat: true,
  lng: true,
  createdAt: true,
  photoKeys: true,
  // The host's name, not their contact details — same as any marketplace
  // listing (Airbnb, etc.) showing who you'd be dealing with before you book.
  // First AND last are sent: clients use the first name in the default listing
  // name ("{firstName}'s driveway") and both for avatar initials. Not remotely
  // the same privacy class as fullAddress/hostCost.
  owner: { select: { firstName: true, lastName: true } },
} satisfies Prisma.ChargerSelect;

@Injectable()
export class ChargersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geocoding: GeocodingService,
    private readonly photos: PhotosService,
    private readonly enodeLink: EnodeLinkService,
    private readonly ocppOnboarding: OcppOnboardingService,
  ) {}

  createPhotoUploadUrl(ownerId: number, contentType: string) {
    return this.photos.createUploadUrl(ownerId, contentType);
  }

  // Backs Discover's search bar — see GeocodingService.geocodeSearchText
  // for what this actually resolves (full postcode, or outcode like
  // "SM5") and what it deliberately doesn't (free-text place names).
  geocodeSearchText(text: string) {
    return this.geocoding.geocodeSearchText(text);
  }

  // The real Add Charger flow for an Enode-route model — see
  // EnodeLinkService for the researched real Link API shape.
  startEnodeLink(ownerId: number) {
    return this.enodeLink.createLinkSession(ownerId);
  }

  resolveEnodeLink(ownerId: number, existingChargerIds: string[]) {
    return this.enodeLink.resolveNewCharger(ownerId, existingChargerIds);
  }

  // The OCPP-route equivalent of startEnodeLink — mints the charge-point
  // identity and WebSocket URL a host needs to enter into their physical
  // charger's own settings. See OcppOnboardingService.
  startOcppOnboarding() {
    return this.ocppOnboarding.startOnboarding();
  }

  isOcppConnected(chargePointId: string) {
    return { connected: this.ocppOnboarding.isConnected(chargePointId) };
  }

  /**
   * Real, hard-blocking gates — not soft warnings — on what connectionRoute
   * a charger can actually be created with right now:
   *
   * - OCPP: requires a real charge point to have actually connected to
   *   Kelo's own OCPP central system under this exact chargePointId (see
   *   OcppOnboardingService.isConnected, which reflects a genuine
   *   BootNotification handshake — see OcppCentralSystem.onClient) — not
   *   merely that a host generated one and never plugged anything in.
   *   Mirrors the ENODE gate below exactly: a client-supplied id is never
   *   trusted at face value, only a server-verified one.
   * - ENODE: requires a real, already-completed Link (see
   *   EnodeLinkService) — enodeChargerId must be present *and* verified
   *   as genuinely belonging to this host's own linked Enode account,
   *   not merely present. A client fabricating a plausible-looking id
   *   without ever completing a real Link is exactly the gap this closes;
   *   trusting a client-supplied id at face value would not be a real
   *   requirement, just a client-side inconvenience.
   * - MOCK: intentionally left alone here — not reachable from
   *   AddChargerScreen (CHARGER_MODELS has no mock-route option), but
   *   still needed for internal/seed use the same way it always has been
   *   (see this project's own seeded demo chargers), so this is a UI-only
   *   restriction for Mock, not an API one.
   */
  async create(ownerId: number, dto: CreateChargerDto) {
    if (dto.connectionRoute === ConnectionRoute.OCPP) {
      if (!dto.ocppChargePointId) {
        throw new BadRequestException("Get connection details and connect your charger before adding it.");
      }
      if (!this.ocppOnboarding.isConnected(dto.ocppChargePointId)) {
        throw new BadRequestException("This charger hasn't connected yet — check its OCPP settings and try again once it's online.");
      }
    }
    if (dto.connectionRoute === ConnectionRoute.ENODE) {
      if (!dto.enodeChargerId) {
        throw new BadRequestException("Link a real charger via Enode before adding it.");
      }
      const verified = await this.enodeLink.verifyChargerBelongsToHost(ownerId, dto.enodeChargerId);
      if (!verified) {
        throw new BadRequestException("This charger isn't linked to your account — complete the Enode Link flow first.");
      }
    }

    const { lat, lng } = await this.geocoding.geocode(dto.postcode);
    const { photos, ...rest } = dto;
    // The server is the sole source of truth for idleRate/overstayRate —
    // computed here from this same request's rate/powerKw, never taken
    // from the client (the DTO doesn't even have those fields; see its
    // own comment). Same formula the mobile app's live preview uses, via
    // the shared @kelo/core function, so what a host sees while typing is
    // exactly what actually gets stored.
    const { idleRate, overstayRate } = deriveIdleAndOverstayRates(dto.rate, dto.powerKw);
    const charger = await this.prisma.charger.create({
      data: { ...rest, idleRate, overstayRate, ownerId, lat, lng, photoKeys: photos ?? [] },
    });
    return this.photos.resolveCharger(charger, { includeKeys: true });
  }

  async findAllForOwner(ownerId: number) {
    const chargers = await this.prisma.charger.findMany({
      where: { ownerId, removedAt: null },
      orderBy: { createdAt: "desc" },
    });
    return this.photos.resolveChargers(chargers, { includeKeys: true });
  }

  async findChargerOrThrow(ownerId: number, id: number) {
    const charger = await this.prisma.charger.findFirst({ where: { id, ownerId, removedAt: null } });
    if (!charger) {
      throw new NotFoundException("Charger not found");
    }
    return charger;
  }

  async findOneForOwner(ownerId: number, id: number) {
    const charger = await this.findChargerOrThrow(ownerId, id);
    return this.photos.resolveCharger(charger, { includeKeys: true });
  }

  async update(ownerId: number, id: number, dto: UpdateChargerDto) {
    const existing = await this.findChargerOrThrow(ownerId, id);
    // Only re-geocode when the postcode actually changed — no reason to
    // hit postcodes.io on every unrelated field edit (e.g. flipping
    // `available`).
    const coords = dto.postcode !== undefined ? await this.geocoding.geocode(dto.postcode) : {};
    const { photos, ...rest } = dto;
    // Recomputed on every update, not just when `rate` is in this
    // particular PATCH — using whichever of rate/powerKw this request
    // actually changes, falling back to the charger's current value for
    // whichever it doesn't. Keeps idleRate/overstayRate always correct
    // for the charger's current rate/power, rather than only on the one
    // field this request happened to touch.
    const effectiveRate = dto.rate ?? existing.rate;
    const effectivePowerKw = dto.powerKw ?? existing.powerKw;
    const { idleRate, overstayRate } = deriveIdleAndOverstayRates(effectiveRate, effectivePowerKw);
    const charger = await this.prisma.charger.update({
      where: { id },
      data: { ...rest, idleRate, overstayRate, ...coords, ...(photos !== undefined ? { photoKeys: photos } : {}) },
    });
    return this.photos.resolveCharger(charger, { includeKeys: true });
  }

  /**
   * Soft delete only — Booking.chargerId has no onDelete: Cascade (the
   * Prisma/Postgres default is RESTRICT), so a hard delete would fail
   * outright the moment any booking, even a long-completed one, exists
   * for this charger. Cascading the delete through to Booking/Session/
   * Transaction to work around that would destroy real financial and
   * session history just because a host stopped listing a charger — soft
   * delete (removedAt, already part of the schema and already filtered
   * on by every charger query) is the only option that preserves that
   * history while still making the charger disappear everywhere it
   * should. Upcoming bookings are cancelled free of charge to the driver,
   * matching the confirmation copy already shown in the app before this
   * was wired to anything real; an active (currently-charging) booking is
   * deliberately left alone — force-ending a live session is a separate,
   * much bigger piece of work than this.
   */
  async remove(ownerId: number, id: number): Promise<void> {
    await this.findChargerOrThrow(ownerId, id);
    await this.prisma.$transaction([
      this.prisma.charger.update({ where: { id }, data: { removedAt: new Date() } }),
      this.prisma.booking.updateMany({
        where: { chargerId: id, status: BookingStatus.UPCOMING },
        data: { status: BookingStatus.CANCELLED },
      }),
    ]);
  }

  /**
   * Public browse: every available, non-removed charger regardless of
   * owner — unlike findAllForOwner, which is scoped to the caller's own
   * listings. select (not include) is what keeps fullAddress/hostCost out
   * of this response; see PUBLIC_CHARGER_SELECT.
   */
  async findDiscover(query: DiscoverQueryDto) {
    const chargers = await this.prisma.charger.findMany({
      where: {
        removedAt: null,
        available: true,
        lat: { not: null },
        lng: { not: null },
      },
      select: PUBLIC_CHARGER_SELECT,
    });

    // The driver's real device location when the mobile app sent one
    // (location permission granted) — falls back to the fixed reference
    // point otherwise, exactly as before this existed (permission denied,
    // or any other caller that doesn't send lat/lng at all).
    const origin = query.lat !== undefined && query.lng !== undefined ? { lat: query.lat, lng: query.lng } : DEFAULT_SEARCH_ORIGIN;

    const withDistance = chargers.map((charger) => ({
      ...charger,
      distanceMiles: haversineMiles(origin, { lat: charger.lat!, lng: charger.lng! }),
    }));

    const filtered =
      query.radiusMiles !== undefined
        ? withDistance.filter((c) => c.distanceMiles <= query.radiusMiles!)
        : withDistance;

    const sorted = filtered.sort((a, b) => a.distanceMiles - b.distanceMiles);
    return this.photos.resolveChargers(sorted);
  }

  /**
   * "This month, across all chargers" for the My Chargers stats cards —
   * real aggregation over this owner's actual Session/Transaction rows for
   * an inclusive [start, end] window, never an estimate. Scoped to the
   * authenticated owner via `booking.charger.ownerId` (the same path every
   * other host-scoped query here uses), and deliberately not filtered by
   * `charger.removedAt` — earnings from a charger a host has since
   * delisted are still earnings they made.
   *
   * - sessions: completed Session rows (endedAt set) that ended in range.
   * - kwh: summed real meter delta (meterEndKwh - meterStartKwh), not
   *   back-derived from energyCost — cost already has commission and rate
   *   baked in, so dividing it back out would be a fabricated number.
   * - earned: summed Transaction.hostNetAmount across every transaction
   *   type. That column is already the post-commission figure, written
   *   once when the transaction is recorded (see SessionsService), so this
   *   is a plain sum — the commission split is not re-derived here.
   */
  async getStatsForOwner(ownerId: number, query: StatsQueryDto) {
    const start = new Date(query.start);
    const end = new Date(query.end);
    const ownedByHost = { booking: { charger: { ownerId } } };

    const [sessions, earned] = await Promise.all([
      this.prisma.session.findMany({
        // A null endedAt can't satisfy gte/lte, so this already excludes
        // still-running sessions without an explicit `not: null`.
        where: { ...ownedByHost, endedAt: { gte: start, lte: end } },
        select: { meterStartKwh: true, meterEndKwh: true },
      }),
      this.prisma.transaction.aggregate({
        _sum: { hostNetAmount: true },
        where: { ...ownedByHost, createdAt: { gte: start, lte: end } },
      }),
    ]);

    const kwh = sessions.reduce(
      (total, s) => total + Math.max(0, (s.meterEndKwh ?? 0) - s.meterStartKwh),
      0,
    );

    return {
      sessions: sessions.length,
      kwh: +kwh.toFixed(1),
      earned: +(earned._sum.hostNetAmount ?? 0).toFixed(2),
    };
  }
}

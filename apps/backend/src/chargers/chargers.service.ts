import { Injectable, NotFoundException } from "@nestjs/common";
import { BookingStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { GeocodingService } from "../geocoding/geocoding.service";
import { haversineMiles } from "../geocoding/haversine";
import { PhotosService } from "../photos/photos.service";
import { DEFAULT_SEARCH_ORIGIN } from "./search-origin";
import { CreateChargerDto } from "./dto/create-charger.dto";
import { UpdateChargerDto } from "./dto/update-charger.dto";
import { DiscoverQueryDto } from "./dto/discover-query.dto";

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
  // listing (Airbnb, etc.) showing who you'd be dealing with before you
  // book. Not remotely the same privacy class as fullAddress/hostCost.
  owner: { select: { name: true } },
} satisfies Prisma.ChargerSelect;

@Injectable()
export class ChargersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geocoding: GeocodingService,
    private readonly photos: PhotosService,
  ) {}

  createPhotoUploadUrl(ownerId: number, contentType: string) {
    return this.photos.createUploadUrl(ownerId, contentType);
  }

  async create(ownerId: number, dto: CreateChargerDto) {
    const { lat, lng } = await this.geocoding.geocode(dto.postcode);
    const { photos, ...rest } = dto;
    const charger = await this.prisma.charger.create({
      data: { ...rest, ownerId, lat, lng, photoKeys: photos ?? [] },
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
    await this.findChargerOrThrow(ownerId, id);
    // Only re-geocode when the postcode actually changed — no reason to
    // hit postcodes.io on every unrelated field edit (e.g. flipping
    // `available`).
    const coords = dto.postcode !== undefined ? await this.geocoding.geocode(dto.postcode) : {};
    const { photos, ...rest } = dto;
    const charger = await this.prisma.charger.update({
      where: { id },
      data: { ...rest, ...coords, ...(photos !== undefined ? { photoKeys: photos } : {}) },
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
}

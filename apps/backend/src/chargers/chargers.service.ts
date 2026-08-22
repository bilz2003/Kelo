import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { GeocodingService } from "../geocoding/geocoding.service";
import { haversineMiles } from "../geocoding/haversine";
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
  ) {}

  async create(ownerId: number, dto: CreateChargerDto) {
    const { lat, lng } = await this.geocoding.geocode(dto.postcode);
    return this.prisma.charger.create({ data: { ...dto, ownerId, lat, lng } });
  }

  findAllForOwner(ownerId: number) {
    return this.prisma.charger.findMany({
      where: { ownerId, removedAt: null },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOneForOwner(ownerId: number, id: number) {
    const charger = await this.prisma.charger.findFirst({ where: { id, ownerId, removedAt: null } });
    if (!charger) {
      throw new NotFoundException("Charger not found");
    }
    return charger;
  }

  async update(ownerId: number, id: number, dto: UpdateChargerDto) {
    await this.findOneForOwner(ownerId, id);
    // Only re-geocode when the postcode actually changed — no reason to
    // hit postcodes.io on every unrelated field edit (e.g. flipping
    // `available`).
    const coords = dto.postcode !== undefined ? await this.geocoding.geocode(dto.postcode) : {};
    return this.prisma.charger.update({ where: { id }, data: { ...dto, ...coords } });
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

    const withDistance = chargers.map((charger) => ({
      ...charger,
      distanceMiles: haversineMiles(DEFAULT_SEARCH_ORIGIN, { lat: charger.lat!, lng: charger.lng! }),
    }));

    const filtered =
      query.radiusMiles !== undefined
        ? withDistance.filter((c) => c.distanceMiles <= query.radiusMiles!)
        : withDistance;

    return filtered.sort((a, b) => a.distanceMiles - b.distanceMiles);
  }
}

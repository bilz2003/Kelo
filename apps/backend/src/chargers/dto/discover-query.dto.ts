import { Type } from "class-transformer";
import { IsNumber, IsOptional, Max, Min } from "class-validator";

export class DiscoverQueryDto {
  // Matches the mobile Discover screen's RADIUS_OPTIONS semantics
  // (miles, e.g. 1/3/5/10/25) — omit to get every available charger,
  // sorted by distance, unfiltered.
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  radiusMiles?: number;

  // The driver's real device location, sent by the mobile app when
  // location permission was granted (see apps/mobile/src/lib/location.ts).
  // Both or neither — ChargersService.findDiscover falls back to
  // DEFAULT_SEARCH_ORIGIN whenever either is missing (permission denied,
  // any other caller that doesn't send them, etc).
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}

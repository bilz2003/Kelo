import { Type } from "class-transformer";
import { IsNumber, IsOptional, Min } from "class-validator";

export class DiscoverQueryDto {
  // Matches the mobile Discover screen's RADIUS_OPTIONS semantics
  // (miles, e.g. 1/3/5/10/25) — omit to get every available charger,
  // sorted by distance, unfiltered.
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  radiusMiles?: number;
}

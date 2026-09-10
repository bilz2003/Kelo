import { IsISO8601 } from "class-validator";

// Backs GET /chargers/stats — an inclusive [start, end] window the mobile
// app derives from the shared TimeFilterButton (month / custom range /
// all-time). Both required: there's no sensible server-side default period
// for "earnings", and silently picking one would be exactly the kind of
// invented number this endpoint exists to remove.
export class StatsQueryDto {
  @IsISO8601()
  start!: string;

  @IsISO8601()
  end!: string;
}

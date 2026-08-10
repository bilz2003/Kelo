import { IsInt, IsISO8601 } from "class-validator";

export class CreateBookingDto {
  @IsInt()
  chargerId!: number;

  @IsISO8601()
  arrivalAt!: string;

  @IsISO8601()
  endAt!: string;
}

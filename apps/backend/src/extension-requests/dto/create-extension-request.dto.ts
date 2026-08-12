import { IsISO8601 } from "class-validator";

export class CreateExtensionRequestDto {
  @IsISO8601()
  requestedEndAt!: string;
}

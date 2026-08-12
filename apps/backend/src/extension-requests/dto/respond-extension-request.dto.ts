import { IsBoolean } from "class-validator";

export class RespondExtensionRequestDto {
  @IsBoolean()
  approve!: boolean;
}

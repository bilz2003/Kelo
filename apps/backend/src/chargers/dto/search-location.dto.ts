import { IsString, MinLength } from "class-validator";

export class SearchLocationDto {
  @IsString()
  @MinLength(1)
  q!: string;
}

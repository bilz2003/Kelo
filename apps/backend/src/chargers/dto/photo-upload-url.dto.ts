import { IsIn } from "class-validator";

export class PhotoUploadUrlDto {
  @IsIn(["image/jpeg", "image/png", "image/webp"])
  contentType!: string;
}

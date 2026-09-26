import { IsString } from "class-validator";
import { NormalizedEmail } from "./normalized-email.decorator";

export class LoginDto {
  @NormalizedEmail()
  email!: string;

  @IsString()
  password!: string;
}

import { IsEmail, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { CreatedVia } from "@prisma/client";

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters" })
  // bcrypt only uses the first 72 bytes of its input — anything past that
  // is silently ignored, so a longer "password" wouldn't actually add
  // strength and would just be misleading about what's protecting the account.
  @MaxLength(72, { message: "Password must be at most 72 characters" })
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, { message: "Password must contain at least one letter and one number" })
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  // Required, not defaulted: a missing value silently becoming "mobile"
  // (or "web") would quietly mislabel accounts. Each client states its own
  // source — the mobile app sends "mobile", the website's server sends
  // "web". Self-reported, so an analytics signal only, never a permission.
  @IsEnum(CreatedVia, { message: 'createdVia must be "web" or "mobile"' })
  createdVia!: CreatedVia;
}

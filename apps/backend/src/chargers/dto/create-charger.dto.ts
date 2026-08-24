import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { CableType, ConnectionRoute } from "@prisma/client";

export class CreateChargerDto {
  @IsString()
  postcode!: string;

  @IsOptional()
  @IsString()
  fullAddress?: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  listingName?: string;

  @IsNumber()
  @Min(0)
  powerKw!: number;

  @IsEnum(CableType)
  cable!: CableType;

  @IsString()
  connector!: string;

  @IsNumber()
  @Min(0)
  rate!: number;

  @IsNumber()
  @Min(0)
  overstayRate!: number;

  @IsNumber()
  @Min(0)
  idleRate!: number;

  @IsNumber()
  @Min(0)
  noShowFee!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hostCost?: number;

  @IsEnum(ConnectionRoute)
  connectionRoute!: ConnectionRoute;

  @IsOptional()
  @IsString()
  ocppChargePointId?: string;

  @IsOptional()
  @IsString()
  enodeVehicleId?: string;

  @IsOptional()
  @IsBoolean()
  available?: boolean;

  // S3 object keys from PhotosService.createUploadUrl, not raw URLs or
  // file bytes — the client uploads directly to S3 via a presigned PUT
  // before ever calling this endpoint, then just references the key here.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @IsString({ each: true })
  photos?: string[];
}

import { PartialType } from "@nestjs/mapped-types";
import { CreateChargerDto } from "./create-charger.dto";

export class UpdateChargerDto extends PartialType(CreateChargerDto) {}

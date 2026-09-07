import { IsArray, IsString } from "class-validator";

export class ResolveEnodeLinkDto {
  // The "before" snapshot returned from the earlier POST
  // /chargers/enode/link-session call, handed back unchanged — see
  // EnodeLinkService.resolveNewCharger for what this is actually used
  // for (diffing against a fresh re-fetch to find the real newly-linked
  // device).
  @IsArray()
  @IsString({ each: true })
  existingChargerIds!: string[];
}

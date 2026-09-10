import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../auth/current-user.decorator";
import { ChargersService } from "./chargers.service";
import { CreateChargerDto } from "./dto/create-charger.dto";
import { UpdateChargerDto } from "./dto/update-charger.dto";
import { DiscoverQueryDto } from "./dto/discover-query.dto";
import { PhotoUploadUrlDto } from "./dto/photo-upload-url.dto";
import { SearchLocationDto } from "./dto/search-location.dto";
import { ResolveEnodeLinkDto } from "./dto/resolve-enode-link.dto";
import { StatsQueryDto } from "./dto/stats-query.dto";

@Controller("chargers")
@UseGuards(JwtAuthGuard)
export class ChargersController {
  constructor(private readonly chargersService: ChargersService) {}

  // Not scoped to a charger id — a photo gets uploaded while filling out
  // Add Charger, before any charger row exists yet. Keyed by the caller's
  // own userId instead; see PhotosService.createUploadUrl.
  @Post("photos/upload-url")
  createPhotoUploadUrl(@CurrentUser() user: RequestUser, @Body() dto: PhotoUploadUrlDto) {
    return this.chargersService.createPhotoUploadUrl(user.userId, dto.contentType);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateChargerDto) {
    return this.chargersService.create(user.userId, dto);
  }

  // The real end-user Link flow (not the sandbox-dashboard virtual-asset
  // creation used for developer testing — see ENODE-INTEGRATION.md).
  // Starts a real Link session against Enode's API for this host's own
  // Enode account; the client opens the returned linkUrl via
  // expo-web-browser and, once it reports completion, calls
  // enode/resolve-link below with the returned existingChargerIds
  // unchanged.
  @Post("enode/link-session")
  startEnodeLink(@CurrentUser() user: RequestUser) {
    return this.chargersService.startEnodeLink(user.userId);
  }

  @Post("enode/resolve-link")
  resolveEnodeLink(@CurrentUser() user: RequestUser, @Body() dto: ResolveEnodeLinkDto) {
    return this.chargersService.resolveEnodeLink(user.userId, dto.existingChargerIds);
  }

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.chargersService.findAllForOwner(user.userId);
  }

  // Must come before @Get(":id") — otherwise "discover" would match the
  // :id route first and fail ParseIntPipe instead of hitting this one.
  @Get("discover")
  discover(@Query() query: DiscoverQueryDto) {
    return this.chargersService.findDiscover(query);
  }

  // Same ordering reason as "discover" above — must come before @Get(":id"),
  // or "stats" parses as an :id and 400s on ParseIntPipe. Real
  // earnings/activity totals across all of this owner's chargers for the
  // given period — see ChargersService.getStatsForOwner.
  @Get("stats")
  stats(@CurrentUser() user: RequestUser, @Query() query: StatsQueryDto) {
    return this.chargersService.getStatsForOwner(user.userId, query);
  }

  // Same ordering reason as "discover" above — must come before @Get(":id").
  // Backs Discover's search bar: resolves typed postcode/area text to a
  // lat/lng the client then re-sends as its own discover origin (see
  // getDiscoverChargers), rather than folding free text into the discover
  // query itself — keeps "what point are we measuring distance from" one
  // concern (lat/lng only) and "how do we get a point from text" a
  // separate one.
  @Get("search-location")
  searchLocation(@Query() query: SearchLocationDto) {
    return this.chargersService.geocodeSearchText(query.q);
  }

  @Get(":id")
  findOne(@CurrentUser() user: RequestUser, @Param("id", ParseIntPipe) id: number) {
    return this.chargersService.findOneForOwner(user.userId, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateChargerDto,
  ) {
    return this.chargersService.update(user.userId, id, dto);
  }

  // Soft delete — see the doc comment on ChargersService.remove for why.
  @Delete(":id")
  @HttpCode(204)
  remove(@CurrentUser() user: RequestUser, @Param("id", ParseIntPipe) id: number) {
    return this.chargersService.remove(user.userId, id);
  }
}

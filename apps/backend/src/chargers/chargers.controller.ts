import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../auth/current-user.decorator";
import { ChargersService } from "./chargers.service";
import { CreateChargerDto } from "./dto/create-charger.dto";
import { UpdateChargerDto } from "./dto/update-charger.dto";
import { DiscoverQueryDto } from "./dto/discover-query.dto";

@Controller("chargers")
@UseGuards(JwtAuthGuard)
export class ChargersController {
  constructor(private readonly chargersService: ChargersService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateChargerDto) {
    return this.chargersService.create(user.userId, dto);
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
}

import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../auth/current-user.decorator";
import { ChargersService } from "./chargers.service";
import { CreateChargerDto } from "./dto/create-charger.dto";
import { UpdateChargerDto } from "./dto/update-charger.dto";

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

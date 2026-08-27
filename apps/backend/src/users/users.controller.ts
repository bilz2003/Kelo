import { Body, Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../auth/current-user.decorator";
import { UsersService } from "./users.service";
import { RegisterPushTokenDto } from "./dto/register-push-token.dto";

@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  me(@CurrentUser() user: RequestUser) {
    return this.usersService.findPublicById(user.userId);
  }

  @Post("me/push-token")
  @HttpCode(204)
  registerPushToken(@CurrentUser() user: RequestUser, @Body() dto: RegisterPushTokenDto) {
    return this.usersService.setPushToken(user.userId, dto.token);
  }
}

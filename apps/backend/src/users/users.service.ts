import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Overwrites whatever token was there before — single-token-per-user by
   * design (see the schema comment on User.pushToken), so registering a
   * new one from a fresh login/reinstall is exactly how the old one gets
   * replaced, not a bug to guard against.
   */
  async setPushToken(id: number, token: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { pushToken: token } });
  }

  async findPublicById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        stripeCustomerId: true,
        stripeConnectAccountId: true,
        createdAt: true,
      },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }
}

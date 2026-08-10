import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateChargerDto } from "./dto/create-charger.dto";
import { UpdateChargerDto } from "./dto/update-charger.dto";

@Injectable()
export class ChargersService {
  constructor(private readonly prisma: PrismaService) {}

  create(ownerId: number, dto: CreateChargerDto) {
    return this.prisma.charger.create({ data: { ...dto, ownerId } });
  }

  findAllForOwner(ownerId: number) {
    return this.prisma.charger.findMany({
      where: { ownerId, removedAt: null },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOneForOwner(ownerId: number, id: number) {
    const charger = await this.prisma.charger.findFirst({ where: { id, ownerId, removedAt: null } });
    if (!charger) {
      throw new NotFoundException("Charger not found");
    }
    return charger;
  }

  async update(ownerId: number, id: number, dto: UpdateChargerDto) {
    await this.findOneForOwner(ownerId, id);
    return this.prisma.charger.update({ where: { id }, data: dto });
  }
}

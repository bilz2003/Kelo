import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface AuthUser {
  id: number;
  email: string;
  name: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  // Refresh tokens are high-entropy random values, not user-chosen
  // passwords — a fast deterministic hash is the right tool here (unlike
  // bcrypt for passwords), since it lets refresh()/logout() find a token
  // with a single indexed lookup instead of comparing against every row.
  private hashRefreshToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  private async issueTokenPair(user: AuthUser) {
    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email },
      { expiresIn: ACCESS_TOKEN_TTL },
    );

    const refreshTokenPlain = crypto.randomBytes(64).toString("hex");
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashRefreshToken(refreshTokenPlain),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return {
      accessToken,
      refreshToken: refreshTokenPlain,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException("An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        phone: dto.phone,
      },
    });

    return this.issueTokenPair(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException("Invalid email or password");
    }

    return this.issueTokenPair(user);
  }

  /**
   * Rotation: every use of a refresh token revokes it and issues a new
   * one. A revoked-but-still-present row that gets presented again means
   * someone is replaying an old token — either a stolen one, or the
   * legitimate client retrying after losing the rotated response. Either
   * way that's a signal the token chain may be compromised, so every
   * refresh token for the user is revoked, forcing a fresh login.
   */
  async refresh(refreshTokenPlain: string) {
    const tokenHash = this.hashRefreshToken(refreshTokenPlain);
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!record) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (record.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException("Refresh token already used — all sessions revoked");
    }

    if (record.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token expired");
    }

    const user = await this.prisma.user.findUnique({ where: { id: record.userId } });
    if (!user) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokenPair(user);
  }

  /** Best-effort: revokes the presented token if it's a real, live one. Never reveals whether it was. */
  async logout(refreshTokenPlain: string): Promise<void> {
    const tokenHash = this.hashRefreshToken(refreshTokenPlain);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

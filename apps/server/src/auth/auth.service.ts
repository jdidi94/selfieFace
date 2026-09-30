import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User, UserType } from '@prisma/client';
import {
  AdminRole as SharedAdminRole,
  UserType as SharedUserType,
  type AuthSession,
  type AuthUser,
} from '@lumea/types';
import {
  forgotPasswordSchema,
  loginSchema,
  oauthExchangeSchema,
  refreshSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '@lumea/validation';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { SesMailService } from '../mail/ses-mail.service';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from './auth.types';
import type { GoogleProfilePayload } from './google.strategy';
import { permissionsForRole } from './permissions.map';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mail: SesMailService,
  ) {}

  async register(input: unknown): Promise<AuthSession> {
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: parsed.data.email.toLowerCase(),
        passwordHash,
        type: UserType.CUSTOMER,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        customer: { create: {} },
      },
    });

    await this.issueEmailVerification(user);

    return this.createSession(user);
  }

  async login(input: unknown): Promise<AuthSession> {
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const user = await this.prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'This account uses Google sign-in. Continue with Google or reset your password to set one.',
      );
    }

    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    this.assertNotBlocked(user);

    // Soft-gate: unverified customers may sign in; AuthUser.emailVerified prompts UI.
    return this.createSession(user);
  }

  async loginWithGoogle(profile: GoogleProfilePayload): Promise<string> {
    let user =
      (await this.prisma.user.findUnique({ where: { googleId: profile.googleId } })) ??
      (await this.prisma.user.findUnique({ where: { email: profile.email } }));

    if (user) {
      if (user.type !== UserType.CUSTOMER) {
        throw new UnauthorizedException('Google sign-in is only available for customer accounts');
      }

      this.assertNotBlocked(user);

      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: user.googleId ?? profile.googleId,
          firstName: user.firstName ?? profile.firstName,
          lastName: user.lastName ?? profile.lastName,
          // Google-confirmed email counts as verified.
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        },
      });
    } else {
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          googleId: profile.googleId,
          passwordHash: null,
          type: UserType.CUSTOMER,
          firstName: profile.firstName,
          lastName: profile.lastName,
          emailVerifiedAt: new Date(),
          customer: { create: {} },
        },
      });
    }

    return this.createOAuthExchangeCode(user.id);
  }

  async exchangeOAuthCode(input: unknown): Promise<AuthSession> {
    const parsed = oauthExchangeSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const tokenHash = this.hashToken(parsed.data.code);
    const record = await this.prisma.oAuthExchangeToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired Google sign-in code');
    }

    await this.prisma.oAuthExchangeToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    return this.createSession(record.user);
  }

  async refresh(input: unknown): Promise<AuthSession> {
    const parsed = refreshSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const tokenHash = this.hashToken(parsed.data.refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.createSession(stored.user);
  }

  async logout(refreshToken?: string): Promise<{ success: true }> {
    if (!refreshToken) {
      return { success: true };
    }

    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.toAuthUser(user);
  }

  async forgotPassword(input: unknown): Promise<{ message: string }> {
    const parsed = forgotPasswordSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const user = await this.prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
    });

    if (user) {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = this.hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await this.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });

      const clientUrl = this.storefrontBaseUrl();
      const resetUrl = `${clientUrl}/account/reset-password?token=${rawToken}`;
      const result = await this.mail.sendPasswordReset({
        to: user.email,
        resetUrl,
        firstName: user.firstName,
        userId: user.id,
      });
      if (!result.sent) {
        // Keep local-dev fallback when SES is unset or send fails.
        console.log(`[password-reset] ${user.email}: ${resetUrl}`);
      }
    }

    return { message: 'If that email exists, a reset link has been sent.' };
  }

  async resetPassword(input: unknown): Promise<{ message: string }> {
    const parsed = resetPasswordSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const tokenHash = this.hashToken(parsed.data.token);
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { message: 'Password updated successfully' };
  }

  async verifyEmail(input: unknown): Promise<{ message: string; emailVerified: true }> {
    const parsed = verifyEmailSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const tokenHash = this.hashToken(parsed.data.token);
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.updateMany({
        where: {
          userId: record.userId,
          usedAt: null,
          id: { not: record.id },
        },
        data: { usedAt: new Date() },
      }),
    ]);

    return { message: 'Email verified successfully', emailVerified: true };
  }

  async resendVerification(input: unknown): Promise<{ message: string }> {
    const parsed = resendVerificationSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const user = await this.prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
    });

    if (user && user.type === UserType.CUSTOMER && !user.emailVerifiedAt) {
      await this.issueEmailVerification(user);
    }

    return {
      message: 'If that account needs verification, a new link has been sent.',
    };
  }

  async resendVerificationForUser(userId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    if (user.emailVerifiedAt) {
      return { message: 'Email is already verified.' };
    }
    if (user.type !== UserType.CUSTOMER) {
      return { message: 'Email is already verified.' };
    }
    await this.issueEmailVerification(user);
    return { message: 'Verification email sent.' };
  }

  signAccessToken(user: User): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      type: user.type,
      adminRole: user.adminRole,
    };
    return this.jwtService.sign(payload);
  }

  private async issueEmailVerification(user: User): Promise<void> {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      }),
    ]);

    const verifyUrl = `${this.storefrontBaseUrl()}/account/verify-email?token=${rawToken}`;
    const result = await this.mail.sendEmailVerification({
      to: user.email,
      verifyUrl,
      firstName: user.firstName,
      userId: user.id,
    });
    if (!result.sent) {
      console.log(`[email-verification] ${user.email}: ${verifyUrl}`);
    }
  }

  private storefrontBaseUrl(): string {
    return (
      process.env.CLIENT_URL ??
      process.env.PASSWORD_RESET_URL_CLIENT ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      'http://localhost:3000'
    ).replace(/\/$/, '');
  }

  private async createOAuthExchangeCode(userId: string): Promise<string> {
    const raw = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(raw);
    const expiresAt = new Date(Date.now() + 60 * 1000);

    await this.prisma.oAuthExchangeToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return raw;
  }

  private async createSession(user: User): Promise<AuthSession> {
    this.assertNotBlocked(user);

    const refreshToken = randomBytes(48).toString('hex');
    const tokenHash = this.hashToken(refreshToken);
    const refreshDays = Number(process.env.JWT_REFRESH_EXPIRES_DAYS ?? 7);
    const expiresAt = new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    return {
      accessToken: this.signAccessToken(user),
      refreshToken,
      user: this.toAuthUser(user),
    };
  }

  private assertNotBlocked(user: Pick<User, 'blockedAt'>): void {
    if (user.blockedAt) {
      throw new UnauthorizedException(
        'This account has been blocked. Contact support if you believe this is an error.',
      );
    }
  }

  private toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      type: user.type as SharedUserType,
      adminRole: user.adminRole as SharedAdminRole | null,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerified: Boolean(user.emailVerifiedAt) || user.type === UserType.ADMIN,
      permissions:
        user.type === UserType.ADMIN ? permissionsForRole(user.adminRole) : undefined,
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

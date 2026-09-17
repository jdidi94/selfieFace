import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { RateLimit } from '../common/rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../common/rate-limit/rate-limit.guard';
import type { RequestUser } from './auth.types';
import type { GoogleProfilePayload } from './google.strategy';

@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @RateLimit({ max: 10, windowMs: 60_000, keyPrefix: 'auth:register' })
  register(@Body() body: unknown) {
    return this.authService.register(body);
  }

  @Post('login')
  @RateLimit({ max: 20, windowMs: 60_000, keyPrefix: 'auth:login' })
  login(@Body() body: unknown) {
    return this.authService.login(body);
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleAuth() {
    // Passport redirects to Google
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:3000';
    try {
      const profile = req.user as GoogleProfilePayload;
      const code = await this.authService.loginWithGoogle(profile);
      return res.redirect(
        `${clientUrl}/api/auth/google/callback?code=${encodeURIComponent(code)}`,
      );
    } catch {
      return res.redirect(`${clientUrl}/account/login?error=google`);
    }
  }

  @Post('google/exchange')
  exchangeGoogle(@Body() body: unknown) {
    return this.authService.exchangeOAuthCode(body);
  }

  @Post('refresh')
  refresh(@Body() body: unknown) {
    return this.authService.refresh(body);
  }

  @Post('logout')
  logout(@Body() body: { refreshToken?: string }) {
    return this.authService.logout(body?.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: RequestUser) {
    return this.authService.me(user.sub);
  }

  @Post('forgot-password')
  @RateLimit({ max: 5, windowMs: 60_000, keyPrefix: 'auth:forgot' })
  forgotPassword(@Body() body: unknown) {
    return this.authService.forgotPassword(body);
  }

  @Post('reset-password')
  @RateLimit({ max: 10, windowMs: 60_000, keyPrefix: 'auth:reset' })
  resetPassword(@Body() body: unknown) {
    return this.authService.resetPassword(body);
  }

  @Post('verify-email')
  @RateLimit({ max: 20, windowMs: 60_000, keyPrefix: 'auth:verify' })
  verifyEmail(@Body() body: unknown) {
    return this.authService.verifyEmail(body);
  }

  @Post('resend-verification')
  @RateLimit({ max: 5, windowMs: 60_000, keyPrefix: 'auth:resend-verify' })
  resendVerification(@Body() body: unknown) {
    return this.authService.resendVerification(body);
  }

  @Post('resend-verification/me')
  @UseGuards(JwtAuthGuard)
  @RateLimit({ max: 5, windowMs: 60_000, keyPrefix: 'auth:resend-verify-me' })
  resendVerificationMe(@CurrentUser() user: RequestUser) {
    return this.authService.resendVerificationForUser(user.sub);
  }
}

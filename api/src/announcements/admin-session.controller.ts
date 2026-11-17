import { Controller, Delete, Get, Post, Body, Req, Res, UnauthorizedException, BadRequestException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AdminAuthService, COOKIE_NAME, EXPIRES_IN_SECONDS } from './admin-auth.service';

@Controller('api/admin-session')
export class AdminSessionController {
  constructor(private readonly auth: AdminAuthService) {}

  @Get()
  status(@Req() req: Request) {
    return { success: true, authenticated: this.auth.isAdmin(req) };
  }

  @Post()
  login(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    if (!body || typeof body !== 'object' || !('username' in body) || !('password' in body) ||
      typeof body.username !== 'string' || typeof body.password !== 'string' ||
      body.username.length > 150 || body.password.length > 256) {
      throw new BadRequestException('Dữ liệu đăng nhập không hợp lệ.');
    }
    if (!this.auth.verifyLogin(body.username.trim(), body.password)) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không đúng.');
    }
    res.cookie(COOKIE_NAME, this.auth.createToken(), {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
      path: '/', maxAge: EXPIRES_IN_SECONDS * 1000,
    });
    return { success: true, authenticated: true };
  }

  @Delete()
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_NAME, { path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    return { success: true };
  }
}

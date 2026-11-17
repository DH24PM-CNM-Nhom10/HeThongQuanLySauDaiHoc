import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { TeacherAuthService } from './teacher-auth.service';

@Controller('api/teacher-auth')
export class TeacherAuthController {
  constructor(private readonly auth: TeacherAuthService) {}

  @Post('login')
  login(@Body() body: { username?: string; password?: string }, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { identity, session } = this.auth.login(body?.username, body?.password, req.ip ?? 'unknown');
    res.cookie(this.auth.cookieName(), session, {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
      path: '/', maxAge: this.auth.cookieMaxAgeMs(),
    });
    return { success: true, user: identity };
  }

  @Get('me')
  me(@Req() req: Request) {
    return { success: true, user: this.auth.fromRequest(req) };
  }

  @Get('profile')
  profile(@Req() req: Request) {
    return { success: true, user: this.auth.getOwnProfile(req) };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(this.auth.cookieName(), { path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    return { success: true };
  }
}

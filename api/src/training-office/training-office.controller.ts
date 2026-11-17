import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { TrainingOfficeService } from './training-office.service';

@Controller('api/training-office')
export class TrainingOfficeController {
  constructor(private readonly office: TrainingOfficeService) {}
  @Post('login')
  login(@Body() body: { username?: string; password?: string }, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { identity, session } = this.office.login(body?.username, body?.password, req.ip ?? 'unknown');
    res.cookie(this.office.cookieName(), session, {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: this.office.cookieMaxAgeMs(),
    });
    return { success: true, user: identity };
  }
  @Get('me')
  me(@Req() req: Request) { return { success: true, user: this.office.fromRequest(req) }; }
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(this.office.cookieName(), { sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
    return { success: true };
  }
  @Get('catalog')
  catalog(@Req() req: Request) { return this.office.catalog(req); }
  @Get('assignments')
  assignments(@Req() req: Request) { return this.office.assignments(req); }
  @Post('assignments')
  assign(@Req() req: Request, @Body() body: unknown) { return this.office.saveAssignments(req, body); }
}

import { Body, Controller, Delete, Get, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { TeacherGradesService } from '../teacher-auth/teacher-grades.service';
import { TrainingOfficeService } from './training-office.service';

@Controller('api/training-office')
export class TrainingOfficeController {
  constructor(private readonly office: TrainingOfficeService, private readonly grades: TeacherGradesService) {}
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
  @Get('gradebooks')
  gradebooks(@Req() req: Request) {
    this.office.fromRequest(req);
    return this.grades.listForReview();
  }
  @Post('gradebooks/:id')
  review(@Req() req: Request, @Param('id') id: string, @Body() body: { action?: string; revision?: number; reason?: string }) {
    return this.grades.review(req, id, body);
  }
  @Get('catalog')
  catalog(@Req() req: Request) { return this.office.catalog(req); }
  @Get('assignments')
  assignments(@Req() req: Request) { return this.office.assignments(req); }
  @Post('assignments/publish')
  publish(@Req() req: Request, @Body() body: unknown) { return this.office.publishAssignments(req, body); }
  @Delete('assignments/:id')
  remove(@Req() req: Request, @Param('id') id: string) { return this.office.deleteAssignment(req, id); }
  @Post('assignments')
  assign(@Req() req: Request, @Body() body: unknown) { return this.office.saveAssignments(req, body); }
}

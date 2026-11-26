import { Body, Controller, Get, Param, Post, Put, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { TeacherAuthService } from './teacher-auth.service';
import { TrainingOfficeService } from '../training-office/training-office.service';
import { TeacherGradesService } from './teacher-grades.service';

@Controller('api/teacher-auth')
export class TeacherAuthController {
  constructor(
    private readonly auth: TeacherAuthService,
    private readonly assignments: TrainingOfficeService,
    private readonly grades: TeacherGradesService,
  ) {}

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
    return { success: true, user: this.auth.fromRequest(req, true) };
  }

  @Post('change-password')
  changePassword(
    @Req() req: Request,
    @Body() body: { currentPassword?: string; newPassword?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = this.auth.changePassword(req, body?.currentPassword, body?.newPassword);
    res.cookie(this.auth.cookieName(), result.session, {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
      path: '/', maxAge: this.auth.cookieMaxAgeMs(),
    });
    res.setHeader('Cache-Control', 'private, no-store');
    return { success: true, user: result.identity };
  }

  @Get('profile')
  profile(@Req() req: Request) {
    return { success: true, user: this.auth.getOwnProfile(req) };
  }

  @Get('assignments')
  assignmentsForMe(@Req() req: Request) {
    const identity = this.auth.fromRequest(req);
    return { success: true, data: this.assignments.assignmentsForTeacher(identity.teacherId) };
  }

  @Get('schedule')
  scheduleForMe(@Req() req: Request) {
    const identity = this.auth.fromRequest(req);
    return { success: true, data: this.assignments.scheduleForTeacher(identity.teacherId) };
  }

  // Giảng viên chỉ đọc/lưu điểm của những lớp học phần đã được phân công chính thức.
  @Get('gradebook/:assignmentId')
  gradebook(@Req() req: Request, @Param('assignmentId') id: string) {
    return this.grades.getGradebook(req, id);
  }

  @Post('gradebook/:assignmentId/sync-roster')
  syncRoster(@Req() req: Request, @Param('assignmentId') id: string, @Body() body: { revision?: number }) { return this.grades.syncForTeacher(req,id,body.revision); }

  @Put('gradebook/:assignmentId')
  saveGradebook(@Req() req: Request, @Param('assignmentId') id: string, @Body() body: unknown) {
    return this.grades.saveGradebook(req, id, body);
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(this.auth.cookieName(), { path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    return { success: true };
  }
}

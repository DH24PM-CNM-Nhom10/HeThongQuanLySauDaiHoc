import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { StudentRecordsService } from './student-records.service';
import { readStore, studentCode } from '../common/data-store';
import { TeacherGradesService } from '../teacher-auth/teacher-grades.service';

@Controller('api/student-records')
export class StudentRecordsController {
  constructor(
    private readonly auth: StudentRecordsService,
    private readonly grades: TeacherGradesService,
  ) {}

  @Post('login')
  login(@Body() body: { username?: string; password?: string }, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { user, session } = this.auth.login(body?.username, body?.password, req.ip || 'unknown');
    res.cookie(this.auth.cookieName(), session, {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
      path: '/', maxAge: this.auth.cookieMaxAgeMs(),
    });
    res.setHeader('Cache-Control', 'private, no-store');
    return { success: true, user };
  }

  @Get('me')
  me(@Req() req: Request) {
    return { success: true, user: this.auth.fromRequest(req, true) };
  }

  @Post('change-password')
  changePassword(
    @Body() body: { currentPassword?: string; newPassword?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = this.auth.changePassword(req, body?.currentPassword, body?.newPassword);
    res.cookie(this.auth.cookieName(), result.session, {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
      path: '/', maxAge: this.auth.cookieMaxAgeMs(),
    });
    res.setHeader('Cache-Control', 'private, no-store');
    return { success: true, user: result.user };
  }

  @Get('profile')
  profile(@Req() req: Request) {
    const user = this.auth.fromRequest(req);
    const student = readStore().students.find(row => studentCode(row) === user.maHocVien.toUpperCase());
    return { success: true, data: student ? [student] : [] };
  }

  @Get('schedule')
  schedule(@Req() req: Request) {
    const user = this.auth.fromRequest(req);
    const store = readStore();
    const student = store.students.find(row => studentCode(row) === user.maHocVien.toUpperCase());
    const rows = store.schedule.filter(row => studentCode(row)
      ? studentCode(row) === user.maHocVien.toUpperCase()
      : Boolean(student?.lop && String(row.lop || row.classCode || "") === student.lop));
    return { success: true, data: rows };
  }

  @Get('grades')
  getMyGrades(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const student = this.auth.fromRequest(req);
    res.setHeader('Cache-Control', 'private, no-store');
    return { success: true, data: this.grades.transcriptForStudent(student.maHocVien) };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(this.auth.cookieName(), { path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    return { success: true };
  }
}

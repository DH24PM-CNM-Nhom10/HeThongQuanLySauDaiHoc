import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AdminSessionGuard } from '../common/admin-session.guard';
import { TeacherGradesService } from './teacher-grades.service';

@Controller('api/grade-review')
@UseGuards(AdminSessionGuard)
export class GradeReviewController {
  constructor(private readonly grades: TeacherGradesService) {}
  @Get()
  list() { return this.grades.listForReview(); }
  @Post(':id')
  review(@Req() req: Request, @Param('id') id: string, @Body() body: { action?: string; revision?: number; reason?: string }) {
    return this.grades.review(req, id, body, true);
  }
}

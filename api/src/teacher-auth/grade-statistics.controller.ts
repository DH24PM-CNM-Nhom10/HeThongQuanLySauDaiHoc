import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { requireManager } from '../common/management-access';
import { readStore } from '../common/data-store';
import { TrainingOfficeService } from '../training-office/training-office.service';
import { buildGradeStatistics } from './grade-statistics';
@Controller('api/grade-statistics')
export class GradeStatisticsController {
  constructor(private readonly office: TrainingOfficeService) {}
  @Get() get(@Req() req: Request, @Query() query: Record<string, string>, @Res({ passthrough: true }) res: Response) {
    requireManager(req, this.office);
    res.setHeader('Cache-Control', 'private, no-store');
    return buildGradeStatistics(readStore(), query);
  }
}

import { BadRequestException, Body, Controller, Get, Param, Post, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { TrainingOfficeService } from '../training-office/training-office.service';
import { OfficeNoticesService } from './office-notices.service';
@Controller('api/office-notices')
export class OfficeNoticesController {
  constructor(private readonly office: TrainingOfficeService, private readonly notices: OfficeNoticesService) {}
  private check(req: Request) { this.office.fromRequest(req); }
  private id(raw: string) { const n=Number(raw); if (!Number.isSafeInteger(n) || n<1) throw new BadRequestException('Mã không hợp lệ'); return n; }
  @Get('public') async publicList() { return {success:true,data:await this.notices.list(false)}; }
  @Get() async list(@Req() req: Request) { this.check(req); return {success:true,data:await this.notices.list(true)}; }
  @Post() async create(@Req() req: Request,@Body() body:unknown) { this.check(req); return {success:true,data:await this.notices.create(this.notices.validate(body))}; }
  @Put(':id') async update(@Req() req: Request,@Param('id') id:string,@Body() body:unknown) { this.check(req); return {success:true,data:await this.notices.update(this.id(id),this.notices.validate(body))}; }
}

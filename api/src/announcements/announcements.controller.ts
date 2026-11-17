import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AnnouncementsService } from './announcements.service';
import { AdminAuthService } from './admin-auth.service';

@Controller('api/thong-bao')
export class AnnouncementsController {
  constructor(private readonly notices: AnnouncementsService, private readonly auth: AdminAuthService) {}

  private requireAdmin(req: Request) {
    if (!this.auth.isAdmin(req)) throw new UnauthorizedException('Bạn cần đăng nhập với quyền quản trị.');
    // Kiểm tra Origin ở các thao tác ghi: cookie SameSite=Lax + giới hạn cùng origin.
    const origin = req.headers.origin;
    if (origin) {
      const allowed = process.env.APP_ORIGIN;
      const forwarded = req.headers['x-forwarded-host'];
      const hosts = [Array.isArray(forwarded) ? forwarded[0] : forwarded, req.headers.host].filter(Boolean);
      try {
        if ((allowed && origin !== allowed) || (!allowed && !hosts.includes(new URL(origin).host))) {
          throw new UnauthorizedException('Origin không hợp lệ.');
        }
      } catch (e) {
        if (e instanceof UnauthorizedException) throw e;
        throw new UnauthorizedException('Origin không hợp lệ.');
      }
    }
  }

  private id(value: string) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 1) throw new BadRequestException('Mã thông báo không hợp lệ.');
    return number;
  }

  @Get()
  async list(@Query('admin') admin: string | undefined, @Req() req: Request) {
    const includeDrafts = admin === '1' && this.auth.isAdmin(req);
    if (admin === '1' && !includeDrafts) throw new UnauthorizedException('Cần đăng nhập admin để xem bản nháp.');
    return { success: true, data: await this.notices.list(includeDrafts) };
  }

  @Post()
  async create(@Req() req: Request, @Body() body: unknown) {
    this.requireAdmin(req);
    const result = await this.notices.create(this.notices.validate(body));
    return { success: true, data: result };
  }

  @Put(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    this.requireAdmin(req);
    const result = await this.notices.update(this.id(id), this.notices.validate(body));
    return { success: true, data: result };
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    this.requireAdmin(req);
    const result = await this.notices.remove(this.id(id));
    return { success: true, data: result };
  }
}

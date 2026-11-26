import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { StudentDocumentsService, type DocumentUpload } from './student-documents.service';
@Controller('api/student-documents')
export class StudentDocumentsController {
  constructor(private readonly documents: StudentDocumentsService) {}
  @Get() list(@Req() req: Request, @Query('student') code?: string) { return this.documents.list(req, code); }
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 8 } }))
  upload(@Req() req: Request, @Body() body: Record<string, unknown>, @UploadedFile() file?: DocumentUpload) { return this.documents.upload(req, body, file); }
  @Patch(':id') review(@Req() req: Request, @Param('id') id: string, @Body() body: { status?: unknown; reason?: unknown; revision?: unknown }) { return this.documents.review(req, id, body); }
  @Delete(':id') remove(@Req() req: Request, @Param('id') id: string, @Body() body: { revision?: unknown }) { return this.documents.remove(req, id, body?.revision); }
  @Get(':id/file') download(@Req() req: Request, @Param('id') id: string, @Res() res: Response) {
    const file = this.documents.file(req, id);
    res.setHeader('Content-Type', file.mime); res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''" + encodeURIComponent(file.name)); res.send(file.buffer);
  }
}

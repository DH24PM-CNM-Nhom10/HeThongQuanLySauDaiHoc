import { Controller, Get, Post, Put, Delete, Param, Body, Query, Logger } from '@nestjs/common';
import { EntitiesService } from './entities.service';

@Controller('api')
export class EntitiesController {
  private readonly logger = new Logger(EntitiesController.name);

  constructor(private readonly entitiesService: EntitiesService) {}

  @Get(':entity')
  getAll(@Param('entity') entity: string, @Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    return this.entitiesService.findAll(entity, parsedLimit);
  }

  @Get(':entity/:id')
  getOne(@Param('entity') entity: string, @Param('id') id: string) {
    return this.entitiesService.findOne(entity, id);
  }

  @Post(':entity')
  create(@Param('entity') entity: string, @Body() body: any) {
    this.logger.log(`[POST /api/${entity}] Đã nhận payload từ UploadMapping`);

    let itemsToSave: any[] | null = null;

    // Tự động giải mã và bóc tách danh sách từ UploadMapping
    if (Array.isArray(body)) {
      itemsToSave = body;
    } else if (body && typeof body === 'object') {
      if (Array.isArray(body.data)) itemsToSave = body.data;
      else if (Array.isArray(body.items)) itemsToSave = body.items;
      else if (Array.isArray(body[entity])) itemsToSave = body[entity];
      else {
        const foundArray = Object.values(body).find((val) => Array.isArray(val));
        if (foundArray) itemsToSave = foundArray as any[];
      }
    }

    // Nếu là thao tác lưu danh sách (Import Excel)
    if (itemsToSave) {
      const savedList = this.entitiesService.saveAll(entity, itemsToSave);
      const len = savedList.length;
      return {
        success: true,
        count: len,
        total: len,
        length: len,
        data: savedList,
      };
    }

    // Nếu là tạo 1 bản ghi lẻ
    const newItem = this.entitiesService.create(entity, body);
    return {
      success: true,
      count: 1,
      total: 1,
      data: newItem,
    };
  }

  @Put(':entity/:id')
  update(@Param('entity') entity: string, @Param('id') id: string, @Body() body: any) {
    return this.entitiesService.update(entity, id, body);
  }

  @Delete(':entity/:id')
  remove(@Param('entity') entity: string, @Param('id') id: string) {
    return this.entitiesService.delete(entity, id);
  }
}
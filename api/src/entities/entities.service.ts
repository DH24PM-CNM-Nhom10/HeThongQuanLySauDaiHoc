import { Injectable, NotFoundException } from '@nestjs/common';
import { StoreService } from '../store/store.service';

@Injectable()
export class EntitiesService {
  constructor(private readonly storeService: StoreService) {}

  findAll(entityKey: string, limit?: number) {
    const list = this.storeService.getEntityData(entityKey);
    if (limit && limit > 0) {
      return list.slice(0, limit);
    }
    return list;
  }

  findOne(entityKey: string, id: string) {
    const list = this.storeService.getEntityData(entityKey);
    const item = list.find(
      (i) => i.id === id || i.maHocVien === id || i.shcc === id || i.cccd === id,
    );
    if (!item) {
      throw new NotFoundException(`Không tìm thấy dữ liệu trong ${entityKey}`);
    }
    return item;
  }

  saveAll(entityKey: string, items: any[]) {
    this.storeService.saveEntityData(entityKey, items);
    return items;
  }

  create(entityKey: string, payload: any) {
    const list = this.storeService.getEntityData(entityKey);
    const newItem = { id: Date.now().toString(), ...payload };
    list.unshift(newItem);
    this.saveAll(entityKey, list);
    return newItem;
  }

  update(entityKey: string, id: string, payload: any) {
    const list = this.storeService.getEntityData(entityKey);
    const index = list.findIndex(
      (i) => i.id === id || i.maHocVien === id || i.shcc === id,
    );
    if (index === -1) {
      throw new NotFoundException(`Không tìm thấy bản ghi để cập nhật`);
    }
    list[index] = { ...list[index], ...payload };
    this.saveAll(entityKey, list);
    return list[index];
  }

  delete(entityKey: string, id: string) {
    let list = this.storeService.getEntityData(entityKey);
    list = list.filter((i) => i.id !== id && i.maHocVien !== id && i.shcc !== id);
    this.saveAll(entityKey, list);
    return { success: true };
  }
}
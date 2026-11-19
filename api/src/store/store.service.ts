import { Injectable } from '@nestjs/common';
import { readStore, saveStore } from '../common/data-store';
@Injectable()
export class StoreService {
  getStore(): Record<string, any[]> { return readStore(); }
  saveStoreToFile(store: Record<string, any[]>): void { saveStore(store); }
  getEntityData(key: string): any[] { return this.getStore()[key] || []; }
  saveEntityData(key: string, data: any[]): void {
    const store = this.getStore();
    store[key] = data;
    this.saveStoreToFile(store);
  }
}

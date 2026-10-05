import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StoreService {
  private readonly logger = new Logger(StoreService.name);
  private readonly dbPath = path.join(process.cwd(), 'db.json');

  getStore(): Record<string, any[]> {
    try {
      if (fs.existsSync(this.dbPath)) {
        const data = fs.readFileSync(this.dbPath, 'utf-8');
        return data.trim()
          ? JSON.parse(data)
          : { students: [], teachers: [], thesis: [], assignments: [], grades: [], schedule: [] };
      }
    } catch (error) {
      this.logger.error('Lỗi khi đọc file db.json:', error);
    }
    return { students: [], teachers: [], thesis: [], assignments: [], grades: [], schedule: [] };
  }

  saveStoreToFile(store: Record<string, any[]>): void {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(store, null, 2), 'utf-8');
    } catch (error) {
      this.logger.error('Lỗi khi ghi file db.json:', error);
    }
  }

  getEntityData(key: string): any[] {
    const store = this.getStore();
    return store[key] || [];
  }

  saveEntityData(key: string, data: any[]): void {
    const store = this.getStore();
    store[key] = data;
    this.saveStoreToFile(store);
  }
}
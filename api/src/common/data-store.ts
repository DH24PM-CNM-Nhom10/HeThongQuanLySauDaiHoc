import fs from 'node:fs';
import path from 'node:path';
import type * as SharedStore from '../../../shared/system-store.cjs';

const modulePath = [
  path.resolve(__dirname, '../../../shared/system-store.cjs'),
  path.resolve(__dirname, '../../../../shared/system-store.cjs'),
].find(file => fs.existsSync(file));
if (!modulePath) throw new Error('Không tìm thấy kho dữ liệu dùng chung.');
const shared: typeof SharedStore = require(modulePath);
export const { readStore, saveStore, projectRoot, studentCode, studentStatus } = shared;

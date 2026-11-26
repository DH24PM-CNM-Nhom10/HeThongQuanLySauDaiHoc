import { Injectable, BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { createPool, type Pool, type RowDataPacket, type ResultSetHeader } from 'mysql2/promise';

export type OfficeNoticeInput = { tieu_de: string; noi_dung: string; ten_file: string; duong_dan_file: string; trang_thai: 'nhap' | 'da_dang' };
@Injectable()
export class OfficeNoticesService {
  private pool?: Pool;
  private db() {
    if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) {
      throw new ServiceUnavailableException('Chưa cấu hình kết nối cơ sở dữ liệu thông báo trong api/.env.');
    }
    return this.pool ??= createPool({host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, waitForConnections: true, connectionLimit: 5, timezone: '+07:00'});
  }
  async list(all = false) {
    const [rows] = await this.db().query<RowDataPacket[]>(`SELECT ma_thong_bao, tieu_de, noi_dung, ten_file, duong_dan_file, DATE_FORMAT(ngay_dang,'%Y-%m-%dT%H:%i:%s') AS ngay_dang, trang_thai FROM thong_bao ${all ? '' : "WHERE trang_thai='da_dang'"} ORDER BY ngay_dang DESC, ma_thong_bao DESC LIMIT 10000`);
    return rows;
  }
  validate(raw: unknown): OfficeNoticeInput {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BadRequestException('Dữ liệu không hợp lệ');
    const b = raw as Record<string, unknown>;
    const s = (k: string) => typeof b[k] === 'string' ? (b[k] as string).trim() : '';
    const tieu_de=s('tieu_de'), noi_dung=s('noi_dung'), ten_file=s('ten_file'), duong_dan_file=s('duong_dan_file');
    const trang_thai=b.trang_thai;
    if (!tieu_de || tieu_de.length>255 || !noi_dung || noi_dung.length>20000 || ten_file.length>255 || duong_dan_file.length>1024 || (trang_thai!=='nhap' && trang_thai!=='da_dang')) throw new BadRequestException('Kiểm tra tiêu đề, nội dung và trạng thái');
    if (duong_dan_file && !((duong_dan_file.startsWith('/') && !duong_dan_file.startsWith('//') && !duong_dan_file.includes('\\')) || /^https:\/\/[^\s]+$/i.test(duong_dan_file))) throw new BadRequestException('Đường dẫn tệp không hợp lệ');
    return {tieu_de, noi_dung, ten_file, duong_dan_file, trang_thai};
  }
  async create(b: OfficeNoticeInput) {
    const [r] = await this.db().execute<ResultSetHeader>('INSERT INTO thong_bao(tieu_de,noi_dung,ten_file,duong_dan_file,trang_thai) VALUES(?,?,?,?,?)',[b.tieu_de,b.noi_dung,b.ten_file,b.duong_dan_file,b.trang_thai]);
    return {ma_thong_bao:r.insertId};
  }
  async update(id: number, b: OfficeNoticeInput) {
    const [r] = await this.db().execute<ResultSetHeader>('UPDATE thong_bao SET tieu_de=?,noi_dung=?,ten_file=?,duong_dan_file=?,trang_thai=? WHERE ma_thong_bao=?',[b.tieu_de,b.noi_dung,b.ten_file,b.duong_dan_file,b.trang_thai,id]);
    if (!r.affectedRows) throw new NotFoundException('Không tìm thấy thông báo');
    return {ma_thong_bao:id};
  }
}

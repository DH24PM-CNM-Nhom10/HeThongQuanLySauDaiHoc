import 'dotenv/config';
import { Injectable, BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import mysql, { type Pool, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';

type Status = 'nhap' | 'da_dang';
export interface NoticeInput {
  tieu_de: string;
  noi_dung: string;
  ten_file: string;
  duong_dan_file: string;
  trang_thai: Status;
}

@Injectable()
export class AnnouncementsService {
  private pool?: Pool;

  private db(): Pool {
    if (!this.pool) {
      if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) {
        throw new ServiceUnavailableException('Chưa cấu hình DB_HOST, DB_USER hoặc DB_NAME cho API.');
      }
      this.pool = mysql.createPool({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME,
        waitForConnections: true, connectionLimit: 5,
        charset: 'utf8mb4', timezone: '+07:00',
      });
    }
    return this.pool;
  }

  async list(includeDrafts: boolean) {
    const condition = includeDrafts ? '' : "WHERE trang_thai = 'da_dang'";
    const [rows] = await this.db().query<RowDataPacket[]>(
      `SELECT ma_thong_bao, tieu_de, noi_dung, ten_file, duong_dan_file,
              DATE_FORMAT(ngay_dang, '%Y-%m-%dT%H:%i:%s') AS ngay_dang, trang_thai
       FROM thong_bao ${condition}
       ORDER BY ngay_dang DESC, ma_thong_bao DESC LIMIT 10000`,
    );
    return rows;
  }

  validate(body: unknown): NoticeInput {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('Dữ liệu không hợp lệ.');
    const b = body as Record<string, unknown>;
    const title = typeof b.tieu_de === 'string' ? b.tieu_de.trim() : '';
    const content = typeof b.noi_dung === 'string' ? b.noi_dung.trim() : '';
    const fileName = typeof b.ten_file === 'string' ? b.ten_file.trim() : '';
    const url = typeof b.duong_dan_file === 'string' ? b.duong_dan_file.trim() : '';
    const status = b.trang_thai === 'da_dang' ? 'da_dang' : b.trang_thai === 'nhap' ? 'nhap' : null;
    if (!title || title.length > 255 || content.length > 20000 || fileName.length > 255 || url.length > 1024 || !status) {
      throw new BadRequestException('Vui lòng kiểm tra tiêu đề, nội dung, file và trạng thái.');
    }
    // Chỉ liên kết nội bộ hoặc HTTPS, không cho javascript: / data: / //host / backslash.
    if (url && !((url.startsWith('/') && !url.startsWith('//') && !url.includes('\\')) || /^https:\/\/[^\s]+$/i.test(url))) {
      throw new BadRequestException('Đường dẫn tệp phải bắt đầu bằng / hoặc https://');
    }
    if (url && !fileName) throw new BadRequestException('Vui lòng nhập tên tệp đính kèm.');
    return { tieu_de: title, noi_dung: content, ten_file: fileName, duong_dan_file: url, trang_thai: status };
  }

  async create(input: NoticeInput) {
    const [r] = await this.db().execute<ResultSetHeader>(
      'INSERT INTO thong_bao (tieu_de, noi_dung, ten_file, duong_dan_file, trang_thai) VALUES (?, ?, ?, ?, ?)',
      [input.tieu_de, input.noi_dung, input.ten_file, input.duong_dan_file, input.trang_thai],
    );
    return { ma_thong_bao: r.insertId };
  }

  async update(id: number, input: NoticeInput) {
    const [r] = await this.db().execute<ResultSetHeader>(
      'UPDATE thong_bao SET tieu_de=?, noi_dung=?, ten_file=?, duong_dan_file=?, trang_thai=? WHERE ma_thong_bao=?',
      [input.tieu_de, input.noi_dung, input.ten_file, input.duong_dan_file, input.trang_thai, id],
    );
    if (!r.affectedRows) throw new NotFoundException('Không tìm thấy thông báo.');
    return { ma_thong_bao: id };
  }

  async remove(id: number) {
    const [r] = await this.db().execute<ResultSetHeader>('DELETE FROM thong_bao WHERE ma_thong_bao = ?', [id]);
    if (!r.affectedRows) throw new NotFoundException('Không tìm thấy thông báo.');
    return { deleted: true };
  }
}

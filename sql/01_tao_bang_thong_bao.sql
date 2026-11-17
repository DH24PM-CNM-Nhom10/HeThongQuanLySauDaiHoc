-- Chạy sau khi đã import DB_QuanLyDaoTaoSauDaiHoc_v1.sql
CREATE DATABASE IF NOT EXISTS quan_ly_dao_tao_sdh CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE quan_ly_dao_tao_sdh;
CREATE TABLE IF NOT EXISTS thong_bao (
  ma_thong_bao BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tieu_de VARCHAR(255) NOT NULL,
  noi_dung TEXT NULL,
  ten_file VARCHAR(255) NOT NULL DEFAULT '',
  duong_dan_file VARCHAR(1024) NOT NULL DEFAULT '',
  ngay_dang DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  trang_thai ENUM('nhap', 'da_dang') NOT NULL DEFAULT 'nhap',
  ngay_tao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ngay_cap_nhat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (ma_thong_bao),
  INDEX idx_trang_thai_ngay_dang (trang_thai, ngay_dang, ma_thong_bao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

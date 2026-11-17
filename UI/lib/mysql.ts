
import mysql, { type Pool } from "mysql2/promise";

let pool: Pool | null = null;

export function getDb(): Pool {
    const host = process.env.DB_HOST;
    const user = process.env.DB_USER;
    const database = process.env.DB_NAME;

    if (!host || !user || !database) {
        throw new Error(
            "Thiếu cấu hình DB_HOST, DB_USER hoặc DB_NAME"
        );
    }

    if (!pool) {
        pool = mysql.createPool({
            host,
            port: Number(process.env.DB_PORT || 3306),
            user,
            password: process.env.DB_PASSWORD || "",
            database,

            waitForConnections: true,
            connectionLimit: 10,
            maxIdle: 10,
            idleTimeout: 60000,
            queueLimit: 0,

            charset: "utf8mb4",
            dateStrings: true,
        });
    }

    return pool;
}

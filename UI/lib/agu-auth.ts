// Dùng ở server (Route Handlers) - không import vào Client Components.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const AGU_SESSION_COOKIE = "agu_session";
export const AGU_SESSION_MAX_AGE = 60 * 60 * 8; // 8 giờ

export type AguUser = {
  role: "admin" | "student";
  maHocVien?: string;
  hoTen?: string;
  email?: string;
};

type SessionPayload = {
  user: AguUser;
  exp: number;
  nonce: string;
};

function getSecret() {
  const secret = process.env.AGU_SESSION_SECRET ?? "";
  if (secret) {
    if (secret.length < 32 || secret.startsWith("THAY_BANG_")) {
      throw new Error("AGU_SESSION_SECRET phải dài ít nhất 32 ký tự");
    }
    return secret;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Thiếu AGU_SESSION_SECRET trên máy chủ production");
  }

  const secretPath = path.join(process.cwd(), ".agu-session-secret");
  try {
    writeFileSync(secretPath, randomBytes(32).toString("base64url"), { flag: "wx", mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const localSecret = readFileSync(secretPath, "utf8").trim();
  if (localSecret.length < 32) throw new Error("Khóa phiên local không hợp lệ");
  return localSecret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function createAguSession(user: AguUser): string {
  const content: SessionPayload = {
    user,
    exp: Math.floor(Date.now() / 1000) + AGU_SESSION_MAX_AGE,
    nonce: randomBytes(16).toString("hex"),
  };
  const encoded = Buffer.from(JSON.stringify(content)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function readAguSession(token?: string): AguUser | null {
  if (!token) return null;
  try {
    const [encoded, received, extra] = token.split(".");
    if (!encoded || !received || extra) return null;
    const expected = Buffer.from(sign(encoded));
    const actual = Buffer.from(received);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const payload: SessionPayload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload || !Number.isFinite(payload.exp) || payload.exp <= Date.now() / 1000) return null;
    if (!payload.user || !["student", "admin"].includes(payload.user.role)) return null;
    return payload.user;
  } catch {
    return null;
  }
}

export function safeEqual(a: string, b: string): boolean {
  const left = createHmac("sha256", "agu-credentials-check").update(a).digest();
  const right = createHmac("sha256", "agu-credentials-check").update(b).digest();
  return timingSafeEqual(left, right);
}

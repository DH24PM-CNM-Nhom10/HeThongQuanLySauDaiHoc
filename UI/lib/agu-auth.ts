
// Dùng ở server (Route Handlers) - không import vào Client Components.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const AGU_SESSION_COOKIE = "agu_session";
export const AGU_SESSION_MAX_AGE = 60 * 60 * 8; // 8 giờ

// Bổ sung đầy đủ 4 vai trò của hệ thống.
export type AguUser = {
  role: "admin" | "student" | "teacher" | "training_office";
  maHocVien?: string;
  maGiangVien?: string;
  hoTen?: string;
  email?: string;
};

type SessionPayload = {
  user: AguUser;
  exp: number;
  nonce: string;
};

const ALLOWED_ROLES: AguUser["role"][] = [
  "admin",
  "student",
  "teacher",
  "training_office",
];

function getSecret() {
  const secret = process.env.AGU_SESSION_SECRET ?? "";

  if (
    secret.length < 32 ||
    secret.startsWith("THAY_BANG_")
  ) {
    throw new Error(
      "Thiếu AGU_SESSION_SECRET (tối thiểu 32 ký tự) trong .env.local"
    );
  }

  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret())
    .update(payload)
    .digest("base64url");
}

export function createAguSession(user: AguUser): string {
  if (!ALLOWED_ROLES.includes(user.role)) {
    throw new Error("Vai trò người dùng không hợp lệ.");
  }

  const content: SessionPayload = {
    user,
    exp: Math.floor(Date.now() / 1000) + AGU_SESSION_MAX_AGE,
    nonce: randomBytes(16).toString("hex"),
  };

  const encoded = Buffer.from(
    JSON.stringify(content)
  ).toString("base64url");

  return `${encoded}.${sign(encoded)}`;
}

export function readAguSession(token?: string): AguUser | null {
  if (!token) return null;

  try {
    const [encoded, received, extra] = token.split(".");

    if (!encoded || !received || extra) return null;

    const expected = Buffer.from(sign(encoded));
    const actual = Buffer.from(received);

    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      return null;
    }

    const payload: SessionPayload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    );

    if (
      !payload ||
      !Number.isFinite(payload.exp) ||
      payload.exp <= Date.now() / 1000
    ) {
      return null;
    }

    if (
      !payload.user ||
      !ALLOWED_ROLES.includes(payload.user.role)
    ) {
      return null;
    }

    return payload.user;
  } catch {
    return null;
  }
}

export function safeEqual(a: string, b: string): boolean {
  const left = createHmac("sha256", "agu-credentials-check")
    .update(a)
    .digest();

  const right = createHmac("sha256", "agu-credentials-check")
    .update(b)
    .digest();

  return timingSafeEqual(left, right);
}

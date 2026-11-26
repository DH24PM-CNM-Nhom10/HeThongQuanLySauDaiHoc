import { NextResponse } from 'next/server';
import { requireAdmin } from './admin-api';

export async function requireStudentManager(request: Request) {
  const denied = requireAdmin(request);
  if (!denied) return null;
  const cookie = request.headers.get('cookie') || '';
  if (!cookie.split(';').some(part => part.trim().startsWith('agu_training_office_session='))) return denied;
  try {
    const base = (process.env.NEST_API_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
    const response = await fetch(base + '/api/training-office/me', { headers: { cookie }, cache: 'no-store', signal: AbortSignal.timeout(5000) });
    const data = await response.json();
    return response.ok && data.user?.role === 'training_office' ? null : denied;
  } catch { return NextResponse.json({ success: false, error: 'Không xác thực được Phòng đào tạo. Kiểm tra máy chủ API.' }, { status: 502 }); }
}

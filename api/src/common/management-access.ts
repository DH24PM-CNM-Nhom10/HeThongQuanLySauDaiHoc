import type { Request } from 'express';
import { requireAdminIdentity } from './admin-session.guard';
import type { TrainingOfficeService } from '../training-office/training-office.service';
export function requireManager(req: Request, office: TrainingOfficeService) {
  try { requireAdminIdentity(req); return { role: 'admin' as const, username: 'admin' }; }
  catch { const user = office.fromRequest(req); return { role: 'training_office' as const, username: user.username }; }
}

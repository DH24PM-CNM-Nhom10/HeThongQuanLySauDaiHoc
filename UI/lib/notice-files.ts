import fs from "node:fs";
import path from "node:path";
import { projectRoot } from "../../shared/system-store.cjs";
export function noticeFileDirectory() {
  const directory = path.join(projectRoot(), "api/storage/notice-attachments");
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  return directory;
}

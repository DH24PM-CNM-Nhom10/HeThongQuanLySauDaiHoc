"use client";

import UploadMapping from "@/components/UploadMapping";

export default function UploadPage() {
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>
        Upload & Mapping dữ liệu
      </h1>
      <UploadMapping />
    </div>
  );
}

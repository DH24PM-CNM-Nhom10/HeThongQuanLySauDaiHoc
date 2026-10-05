<<<<<<< HEAD
// app/upload/page.tsx
"use client";

// ⚠️ Đảm bảo đổi tên thành UploadMapping_2 nếu bạn dùng file UploadMapping_2.tsx
import UploadMapping from "../../components/UploadMapping";
import { useRouter } from "next/navigation";

export default function UploadPage() {
  const router = useRouter();

  const handleSuccess = (entityKey?: string) => {
    // 🛑 ĐÃ XÓA DB.syncAllFromApi() để tránh việc Server trả về rỗng xóa mất LocalStorage!

    if (entityKey) {
      router.push(`/${entityKey}`);
    } else {
      router.push("/students");
    }
  };

=======
"use client";

import UploadMapping from "@/components/UploadMapping";

export default function UploadPage() {
>>>>>>> 10511a5b95d46554e53b0758e41ce6996e024e6d
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>
        Upload & Mapping dữ liệu
      </h1>
<<<<<<< HEAD
      <UploadMapping onSuccess={handleSuccess} />
    </div>
  );
}
=======
      <UploadMapping />
    </div>
  );
}
>>>>>>> 10511a5b95d46554e53b0758e41ce6996e024e6d

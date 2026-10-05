"use client";

<<<<<<< HEAD
import StudentManagementTable from "../../components/StudentManagementTable";
=======
import DataTable from "@/components/DataTable";
>>>>>>> 10511a5b95d46554e53b0758e41ce6996e024e6d

export default function StudentsPage() {
  return (
    <div>
<<<<<<< HEAD
      <StudentManagementTable />
    </div>
  );
}
=======
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>
        Quản lý Học viên
      </h1>
      <DataTable entityKey="students" />
    </div>
  );
}
>>>>>>> 10511a5b95d46554e53b0758e41ce6996e024e6d

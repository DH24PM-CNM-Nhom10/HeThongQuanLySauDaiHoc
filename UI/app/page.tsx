"use client";

import { useEffect, useState } from "react";
import { DB } from "@/lib/db";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function DashboardPage() {
  const [stats, setStats] = useState({
    students: 0,
    teachers: 0,
    assignments: 0,
    grades: 0,
    thesis: 0,
  });

  useEffect(() => {
    setStats({
      students: DB.count("students"),
      teachers: DB.count("teachers"),
      assignments: DB.count("assignments"),
      grades: DB.count("grades"),
      thesis: DB.count("thesis"),
    });
  }, []);

  const barData = {
    labels: ["Học viên", "Giảng viên", "Phân công", "Điểm", "Luận văn"],
    datasets: [
      {
        label: "Số lượng",
        data: [
          stats.students,
          stats.teachers,
          stats.assignments,
          stats.grades,
          stats.thesis,
        ],
        backgroundColor: [
          "#3b82f6",
          "#10b981",
          "#f59e0b",
          "#8b5cf6",
          "#ef4444",
        ],
      },
    ],
  };

  const doughnutData = {
    labels: ["Học viên", "Giảng viên", "Phân công"],
    datasets: [
      {
        data: [stats.students, stats.teachers, stats.assignments],
        backgroundColor: ["#3b82f6", "#10b981", "#f59e0b"],
      },
    ],
  };

  return (
    <div>
      <h1 className="h3 mb-4" style={{ fontSize: 22, fontWeight: 700 }}>
        Bảng điều khiển
      </h1>

      <div className="grid-stats">
        <div className="stat-card">
          <div className="stat-label">Học viên</div>
          <div className="stat-value">{stats.students}</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">Giảng viên</div>
          <div className="stat-value">{stats.teachers}</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">Phân công</div>
          <div className="stat-value">{stats.assignments}</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-label">Kết quả học tập</div>
          <div className="stat-value">{stats.grades}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Luận văn</div>
          <div className="stat-value">{stats.thesis}</div>
        </div>
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <div className="card-title">📊 Thống kê tổng quan</div>
          <div className="chart-container">
            <Bar
              data={barData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
              }}
            />
          </div>
        </div>

        <div className="chart-card">
          <div className="card-title">📈 Tỷ lệ dữ liệu</div>
          <div className="chart-container">
            <Doughnut
              data={doughnutData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

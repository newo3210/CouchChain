"use client";
import dynamic from "next/dynamic";
import Header from "@/components/ui/Header";

const PassportDashboard = dynamic(
  () => import("@/components/passport/PassportDashboard"),
  { ssr: false },
);

export default function PassportPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <PassportDashboard />
    </div>
  );
}

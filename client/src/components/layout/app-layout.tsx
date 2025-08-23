import { useState } from "react";
import Sidebar from "./sidebar";
import TopNavbar from "./top-navbar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        <TopNavbar onMenuClick={() => setSidebarOpen(true)} />
        {children}
      </div>
    </div>
  );
}

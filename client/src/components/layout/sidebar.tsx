import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  Truck, 
  BarChart3, 
  Package, 
  Users, 
  Building2, 
  Settings, 
  FileDown, 
  History 
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user } = useAuth();
  const [location] = useLocation();

  const navigation = [
    { name: "Dashboard", href: "/", icon: BarChart3, current: location === "/" },
    { name: "Couriers", href: "/couriers", icon: Package, current: location === "/couriers" },
  ];

  // Add admin-only navigation items
  if (user?.role === 'admin') {
    navigation.push(
      { name: "Users", href: "/users", icon: Users, current: location === "/users" },
      { name: "Departments", href: "/departments", icon: Building2, current: location === "/departments" },
      { name: "Settings", href: "/settings", icon: Settings, current: location === "/settings" }
    );
  }

  const secondaryNavigation = [
    { name: "Export Data", href: "/export", icon: FileDown },
    { name: "Audit Logs", href: "/audit-logs", icon: History },
  ];

  return (
    <>
      {/* Mobile sidebar overlay */}
      <div className={cn("fixed inset-0 flex z-40 lg:hidden", isOpen ? "block" : "hidden")}>
        <div className="fixed inset-0 bg-slate-600 bg-opacity-75" onClick={onClose}></div>
        
        <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={onClose}
              data-testid="button-close-sidebar"
            >
              <span className="sr-only">Close sidebar</span>
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <SidebarContent navigation={navigation} secondaryNavigation={secondaryNavigation} />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col">
        <SidebarContent navigation={navigation} secondaryNavigation={secondaryNavigation} />
      </div>
    </>
  );
}

function SidebarContent({ navigation, secondaryNavigation }: any) {
  const handleSecondaryNavigation = (name: string) => {
    if (name === 'Export Data') {
      handleExportData();
    } else if (name === 'Audit Logs') {
      window.location.href = '/settings';
    }
  };

  const handleExportData = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/couriers/export', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `couriers-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        alert('Export failed. Please try again.');
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed. Please try again.');
    }
  };
  return (
    <div className="flex flex-col flex-grow bg-white border-r border-slate-200 pt-5 pb-4 overflow-y-auto">
      <div className="flex items-center flex-shrink-0 px-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <Truck className="h-8 w-8 text-primary" />
          </div>
          <div className="ml-3">
            <h1 className="text-xl font-bold text-slate-800">CourierTrack</h1>
          </div>
        </div>
      </div>
      
      <div className="mt-8 flex-grow flex flex-col">
        <nav className="flex-1 px-4 space-y-1">
          {navigation.map((item: any) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                item.current
                  ? "bg-primary bg-opacity-10 text-primary"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                "group flex items-center px-2 py-2 text-sm font-medium rounded-md"
              )}
              data-testid={`link-${item.name.toLowerCase().replace(' ', '-')}`}
            >
              <item.icon className="mr-3 h-4 w-4" />
              {item.name}
            </Link>
          ))}

          {/* Reports Section */}
          <div className="pt-4 border-t border-slate-200">
            {secondaryNavigation.map((item: any) => (
              <button
                key={item.name}
                onClick={() => handleSecondaryNavigation(item.name)}
                className="w-full text-left text-slate-600 hover:bg-slate-50 hover:text-slate-900 group flex items-center px-2 py-2 text-sm font-medium rounded-md"
                data-testid={`link-${item.name.toLowerCase().replace(' ', '-')}`}
              >
                <item.icon className="mr-3 h-4 w-4" />
                {item.name}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}

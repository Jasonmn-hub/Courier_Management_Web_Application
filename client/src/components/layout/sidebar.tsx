import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ExportDialog } from "@/components/export-dialog";
import lightLogo from "@/assets/light-logo.png";
import { 
  Truck, 
  BarChart3, 
  Package, 
  Users, 
  Building2, 
  MapPin,
  Settings, 
  FileDown, 
  History,
  FormInput,
  User,
  LogOut,
  FileText,
  Shield,
  Store,
  KeyRound
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user } = useAuth();
  const [location] = useLocation();

  // Fetch user's accessible tabs based on their department policies
  const { data: userPermissions } = useQuery({
    queryKey: ["/api/user-permissions"],
    enabled: !!user,
    retry: false,
  });

  // Check if user has access to branches
  const shouldShowBranches = (user as any)?.role === 'admin' || (user as any)?.role === 'sub_admin' || 
    userPermissions?.accessibleTabs?.includes('branches');

  const navigation = [
    { name: "Dashboard", href: "/", icon: BarChart3, current: location === "/" },
    { name: "Sent Couriers", href: "/couriers", icon: Package, current: location === "/couriers" },
    { name: "Received Couriers", href: "/received-couriers", icon: Truck, current: location === "/received-couriers" },
    { name: "Authority Letter", href: "/authority-letter", icon: FileDown, current: location === "/authority-letter" },
    ...(shouldShowBranches && user?.role !== 'admin' && user?.role !== 'sub_admin' ? [{ name: "Branch List", href: "/branches", icon: MapPin, current: location === "/branches" }] : []),
  ];

  // Admin and Sub-Admin navigation items with proper grouping
  const adminNavigation = ((user as any)?.role === 'admin' || (user as any)?.role === 'sub_admin') ? [
    { name: "Users & Roles", href: "/users", icon: Users, current: location === "/users", group: "management" },
    { name: "User Policies", href: "/user-policies", icon: Shield, current: location === "/user-policies", group: "management" },
    { name: "Departments", href: "/departments", icon: Building2, current: location === "/departments", group: "management" },
    ...(shouldShowBranches ? [{ name: "Branch List", href: "/branches", icon: MapPin, current: location === "/branches", group: "management" }] : []),
    { name: "Vendor Master", href: "/vendors", icon: Store, current: location === "/vendors", group: "management" },
    { name: "Manage Authority Letter", href: "/manage-authority-letter", icon: FileText, current: location === "/manage-authority-letter", group: "management" },
    { name: "Settings", href: "/settings", icon: Settings, current: false, group: "settings" },
    { name: "SAML SSO", href: "/settings?tab=saml", icon: KeyRound, current: false, group: "settings" },
    { name: "Custom Fields", href: "/custom-fields", icon: FormInput, current: location === "/custom-fields", group: "settings" },
    { name: "Audit Logs", href: "/audit-logs", icon: History, current: location === "/audit-logs", group: "settings" },
    { name: "Export Data", href: "/export", icon: FileDown, group: "tools" },
  ] : [];

  // Manager navigation items (export access)
  const managerNavigation = ((user as any)?.role === 'manager') ? [
    { name: "Export Data", href: "/export", icon: FileDown, group: "tools" },
  ] : [];

  // Combine admin and manager navigation (sub_admin is already included in adminNavigation)
  const privilegedNavigation = [...adminNavigation, ...managerNavigation];

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    window.location.href = '/';
  };

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
          <SidebarContent navigation={navigation} adminNavigation={privilegedNavigation} user={user} onLogout={handleLogout} />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col">
        <SidebarContent navigation={navigation} adminNavigation={privilegedNavigation} user={user} onLogout={handleLogout} />
      </div>
    </>
  );
}

function SidebarContent({ navigation, adminNavigation, user, onLogout }: any) {
  const [location] = useLocation();
  
  // Check current URL parameters to determine active state
  const isOnSamlTab = () => {
    return location === "/settings" && window.location.search.includes("tab=saml");
  };
  
  const isOnSettingsButNotSaml = () => {
    return location === "/settings" && !window.location.search.includes("tab=saml");
  };

  return (
    <div className="flex flex-col flex-grow bg-white border-r border-slate-200 overflow-y-auto">
      <div className="flex items-center justify-center flex-shrink-0 px-6 pt-5 pb-4">
        <div className="flex-shrink-0">
          <img 
            src={lightLogo} 
            alt="Light Microfinance" 
            className="h-48 w-48 object-contain" 
          />
        </div>
      </div>
      
      <div className="flex-grow flex flex-col">
        <nav className="flex-1 px-4 space-y-1">
          {/* Main Navigation */}
          {navigation.map((item: any) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                item.current
                  ? "bg-primary bg-opacity-10 text-black font-bold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                "group flex items-center px-2 py-2 text-sm font-medium rounded-md"
              )}
              data-testid={`link-${item.name.toLowerCase().replace(' ', '-')}`}
            >
              <item.icon className="mr-3 h-4 w-4" />
              {item.name}
            </Link>
          ))}

          {/* Admin Management Section */}
          {adminNavigation.filter((item: any) => item.group === "management").length > 0 && (
            <div className="pt-4 border-t border-slate-200">
              {adminNavigation
                .filter((item: any) => item.group === "management")
                .map((item: any) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      item.current
                        ? "bg-primary bg-opacity-10 text-black font-bold"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                      "group flex items-center px-2 py-2 text-sm font-medium rounded-md"
                    )}
                    data-testid={`link-${item.name.toLowerCase().replace(' ', '-')}`}
                  >
                    <item.icon className="mr-3 h-4 w-4" />
                    {item.name}
                  </Link>
                ))}
            </div>
          )}

          {/* Settings Section */}
          {adminNavigation.filter((item: any) => item.group === "settings").length > 0 && (
            <div className="pt-4 border-t border-slate-200">
              {adminNavigation
                .filter((item: any) => item.group === "settings")
                .map((item: any) => {
                  // Dynamic current state based on item name and URL
                  let isCurrent = false;
                  if (item.name === "Settings") {
                    isCurrent = isOnSettingsButNotSaml();
                  } else if (item.name === "SAML SSO") {
                    isCurrent = isOnSamlTab();
                  } else {
                    isCurrent = item.current;
                  }
                  
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        isCurrent
                          ? "bg-primary bg-opacity-10 text-black font-bold"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                        "group flex items-center px-2 py-2 text-sm font-medium rounded-md"
                      )}
                      data-testid={`link-${item.name.toLowerCase().replace(' ', '-')}`}
                    >
                      <item.icon className="mr-3 h-4 w-4" />
                      {item.name}
                    </Link>
                  );
                })}
            </div>
          )}

          {/* Tools Section */}
          {adminNavigation.filter((item: any) => item.group === "tools").length > 0 && (
            <div className="pt-4 border-t border-slate-200">
              {adminNavigation
                .filter((item: any) => item.group === "tools")
                .map((item: any) => (
                  <ExportDialog
                    key={item.name}
                    title="Courier Data"
                    exportType="couriers"
                  >
                    <button
                      className="w-full text-left text-slate-600 hover:bg-slate-50 hover:text-slate-900 group flex items-center px-2 py-2 text-sm font-medium rounded-md"
                      data-testid={`button-${item.name.toLowerCase().replace(' ', '-')}`}
                    >
                      <item.icon className="mr-3 h-4 w-4" />
                      {item.name}
                    </button>
                  </ExportDialog>
                ))}
            </div>
          )}
        </nav>

        {/* Account Profile Section */}
        <div className="px-4 py-4 border-t border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <User className="h-8 w-8 text-slate-400 bg-slate-100 rounded-full p-1" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {user?.name || user?.email || "User"}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {user?.role || "Role"}
              </p>
            </div>
            <button
              onClick={onLogout}
              className="flex-shrink-0 text-slate-400 hover:text-slate-600"
              data-testid="button-logout"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

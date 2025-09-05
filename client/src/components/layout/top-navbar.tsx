import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Menu, Bell, ChevronDown } from "lucide-react";
import { useLocation } from "wouter";
import AccountProfile from "./account-profile";
import lightLogo from "@/assets/light-logo.png";

interface TopNavbarProps {
  onMenuClick: () => void;
}

export default function TopNavbar({ onMenuClick }: TopNavbarProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();



  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  const getInitials = (name?: string, firstName?: string, lastName?: string) => {
    if (name) return name.charAt(0).toUpperCase();
    if (firstName && lastName) return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
    if (firstName) return firstName.charAt(0).toUpperCase();
    return "U";
  };

  const getDisplayName = () => {
    const userData = user as any;
    if (userData?.name) return userData.name;
    if (userData?.firstName && userData?.lastName) return `${userData.firstName} ${userData.lastName}`;
    if (userData?.firstName) return userData.firstName;
    return userData?.email || "User";
  };

  return (
    <div className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow border-b border-slate-200">
      {/* Mobile menu button */}
      <button
        className="px-4 border-r border-slate-200 text-slate-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary lg:hidden"
        onClick={onMenuClick}
        data-testid="button-mobile-menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1 px-4 flex justify-between items-center">
        {/* Left side - Logo and Title */}
        <div className="flex items-center space-x-4">
          <div className="flex-shrink-0">
            <img 
              src={lightLogo} 
              alt="Light Microfinance" 
              className="h-12 w-12 object-contain" 
            />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Light Finance Courier Management System</h1>
          </div>
        </div>
        
        {/* Right side */}
        <div className="ml-4 flex items-center md:ml-6 space-x-4">
          {/* Notifications */}
          <Button 
            variant="ghost" 
            size="sm" 
            className="relative p-2"
            data-testid="button-notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              3
            </span>
          </Button>

          {/* Account Profile */}
          <AccountProfile />
        </div>
      </div>
    </div>
  );
}

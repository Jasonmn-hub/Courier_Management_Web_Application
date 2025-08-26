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
import { Menu, Search, Bell, ChevronDown } from "lucide-react";
import AccountProfile from "./account-profile";

interface TopNavbarProps {
  onMenuClick: () => void;
}

export default function TopNavbar({ onMenuClick }: TopNavbarProps) {
  const { user, logout } = useAuth();

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
        {/* Search bar */}
        <div className="flex-1 flex">
          <div className="w-full flex md:ml-0">
            <div className="relative w-full max-w-lg">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <Input 
                className="pl-10 pr-3 py-2"
                placeholder="Search couriers, POD numbers..."
                data-testid="input-search"
              />
            </div>
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

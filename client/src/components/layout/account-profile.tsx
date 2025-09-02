import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, LogOut, Settings, Mail, Building, Calendar, Phone, Hash, UserCheck } from "lucide-react";

export default function AccountProfile() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Type guard for user properties
  const userData = user as any;

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    window.location.href = '/';
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center space-x-2 text-slate-600 hover:text-slate-900"
          data-testid="button-account-profile"
        >
          <User className="h-4 w-4" />
          <span className="hidden md:inline">Profile</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Account Profile
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* User Avatar */}
          <div className="flex items-center justify-center">
            <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="h-10 w-10 text-primary" />
            </div>
          </div>

          {/* User Details */}
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-slate-900" data-testid="text-user-name">
                {userData?.name || (userData?.firstName + ' ' + userData?.lastName) || 'User'}
              </h3>
              <Badge variant="secondary" className="mt-1" data-testid="badge-user-role">
                {userData?.role?.toUpperCase() || 'USER'}
              </Badge>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-700">Email</p>
                  <p className="text-sm text-slate-500" data-testid="text-user-email">
                    {userData?.email || 'Not provided'}
                  </p>
                </div>
              </div>

              {userData?.employeeCode && (
                <div className="flex items-center gap-3">
                  <Hash className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">Employee Code</p>
                    <p className="text-sm text-slate-500" data-testid="text-user-employee-code">
                      {userData.employeeCode}
                    </p>
                  </div>
                </div>
              )}

              {userData?.mobileNumber && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">Mobile Number</p>
                    <p className="text-sm text-slate-500" data-testid="text-user-mobile">
                      {userData.mobileNumber}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Building className="h-4 w-4 text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-700">Department</p>
                  <p className="text-sm text-slate-500" data-testid="text-user-department">
                    {userData?.departmentName || 'Not assigned'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <UserCheck className="h-4 w-4 text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-700">User ID</p>
                  <p className="text-sm text-slate-500 font-mono text-xs" data-testid="text-user-id">
                    {userData?.id || 'Not available'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-700">Member Since</p>
                  <p className="text-sm text-slate-500" data-testid="text-user-created">
                    {userData?.createdAt 
                      ? new Date(userData.createdAt).toLocaleDateString()
                      : 'Not available'
                    }
                  </p>
                </div>
              </div>

              {userData?.updatedAt && userData?.updatedAt !== userData?.createdAt && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">Last Updated</p>
                    <p className="text-sm text-slate-500" data-testid="text-user-updated">
                      {new Date(userData.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 flex items-center gap-2"
                data-testid="button-settings"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleLogout}
                className="flex-1 flex items-center gap-2"
                data-testid="button-logout-profile"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
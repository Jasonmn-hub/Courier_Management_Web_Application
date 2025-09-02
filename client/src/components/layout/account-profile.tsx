import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { User, LogOut, Mail, Building, Calendar, Phone, Hash, Camera, Upload } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function AccountProfile() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch departments to get department name
  const { data: departments = [] } = useQuery({
    queryKey: ['/api/departments'],
    enabled: !!user?.departmentId,
  });

  // Type guard for user properties
  const userData = user as any;
  
  // Get department name
  const departmentName = departments.find((dept: any) => dept.id === userData?.departmentId)?.name || 'Not assigned';
  
  // Format date as DD/MM/YYYY
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not available';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    window.location.href = '/';
  };

  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('profileImage', file);
      
      const response = await fetch('/api/users/profile-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload image');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      toast({
        title: "Success",
        description: "Profile picture updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to upload profile picture",
        variant: "destructive",
      });
    },
  });

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({
          title: "Error",
          description: "Image size must be less than 2MB",
          variant: "destructive",
        });
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Error",
          description: "Please select a valid image file",
          variant: "destructive",
        });
        return;
      }
      
      uploadImageMutation.mutate(file);
    }
  };

  const triggerImageUpload = () => {
    fileInputRef.current?.click();
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
          {/* User Avatar with Upload */}
          <div className="flex items-center justify-center">
            <div className="relative">
              <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center overflow-hidden">
                {userData?.profileImageUrl ? (
                  <img 
                    src={userData.profileImageUrl} 
                    alt="Profile" 
                    className="h-full w-full object-cover"
                    data-testid="img-user-avatar"
                  />
                ) : (
                  <User className="h-10 w-10 text-primary" />
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0"
                onClick={triggerImageUpload}
                disabled={uploadImageMutation.isPending}
                data-testid="button-upload-avatar"
              >
                {uploadImageMutation.isPending ? (
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Camera className="h-3 w-3" />
                )}
              </Button>
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                data-testid="input-profile-image"
              />
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
                  <p className="text-sm font-medium text-slate-700">Email Address</p>
                  <p className="text-sm text-slate-500" data-testid="text-user-email">
                    {userData?.email || 'Not provided'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Hash className="h-4 w-4 text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-700">Employee Code</p>
                  <p className="text-sm text-slate-500" data-testid="text-user-employee-code">
                    {userData?.employeeCode || 'Not provided'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-700">Mobile Number</p>
                  <p className="text-sm text-slate-500" data-testid="text-user-mobile">
                    {userData?.mobileNumber || 'Not provided'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Building className="h-4 w-4 text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-700">Department</p>
                  <p className="text-sm text-slate-500" data-testid="text-user-department">
                    {departmentName}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-700">Account Creation Date</p>
                  <p className="text-sm text-slate-500" data-testid="text-user-created">
                    {formatDate(userData?.createdAt)}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex justify-center">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleLogout}
                className="flex items-center gap-2"
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
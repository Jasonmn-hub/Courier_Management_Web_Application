import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Edit, Trash2, Settings, Search } from "lucide-react";
import { formatEntityId } from "@/lib/idUtils";

interface UserTableProps {
  onEdit?: (user: any) => void;
  onManageDepartments?: (user: any) => void;
}

export default function UserTable({ onEdit, onManageDepartments }: UserTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: userData, isLoading } = useQuery({
    queryKey: ['/api/admin/users'],
  });

  // Filter users on the client side
  const users = userData ? (Array.isArray(userData) ? userData : (userData as any)?.users || []).filter((user: any) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      user.firstName?.toLowerCase().includes(searchLower) ||
      user.lastName?.toLowerCase().includes(searchLower) ||
      user.name?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.role?.toLowerCase().includes(searchLower) ||
      user.id?.toLowerCase().includes(searchLower)
    );
  }) : [];

  const { data: departments } = useQuery({
    queryKey: ['/api/departments'],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/users/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      // Check if it's a 404 error (user already deleted)
      if (error.status === 404) {
        // Refresh the data anyway since user might be already deleted
        queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
        toast({
          title: "Success",
          description: "User deleted successfully",
        });
        return;
      }
      
      toast({
        title: "Error", 
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (id: string) => {
    const user = users?.find((u: any) => u.id === id);
    const userName = user?.name || user?.email || 'this user';
    
    if (confirm(`Are you sure you want to delete ${userName}? This action cannot be undone.`)) {
      deleteMutation.mutate(id);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'manager':
        return 'bg-blue-100 text-blue-800';
      case 'user':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getDepartmentName = (departmentId: number | null) => {
    if (!departmentId || !departments || !Array.isArray(departments)) return 'No Department';
    const dept = departments.find((d: any) => d.id === departmentId);
    return dept?.name || 'Unknown Department';
  };

  const getDepartmentNames = (userDepartments: Array<{ id: number; name: string }> | undefined) => {
    if (!userDepartments || userDepartments.length === 0) return [];
    return userDepartments;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Users...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
            <div className="h-4 bg-slate-200 rounded w-5/6"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Users</CardTitle>
        <p className="text-sm text-slate-500">
          {Array.isArray(users) ? users.length : 0} users registered in the system
        </p>
        
        {/* Search Input */}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
          <Input
            placeholder="Search users by name, email, or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-users"
          />
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Departments</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!Array.isArray(users) || users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                  No users found. Add your first user to get started.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user: any) => (
                <TableRow key={user.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium" data-testid={`text-name-${user.id}`}>
                    {user.name || 
                     (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : 
                      user.firstName || user.lastName || user.email)
                    }
                  </TableCell>
                  <TableCell data-testid={`text-email-${user.id}`}>
                    {user.email}
                  </TableCell>
                  <TableCell data-testid={`text-mobile-${user.id}`}>
                    {user.mobileNumber || '-'}
                  </TableCell>
                  <TableCell data-testid={`badge-role-${user.id}`}>
                    <Badge className={getRoleColor(user.role)} variant="secondary">
                      {user.role?.charAt(0).toUpperCase() + user.role?.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell data-testid={`text-department-${user.id}`}>
                    <div className="flex flex-wrap gap-1">
                      {getDepartmentNames(user.departments).length > 0 ? (
                        getDepartmentNames(user.departments).map((dept) => (
                          <Badge key={dept.id} variant="outline" className="text-xs">
                            {dept.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-slate-500 text-sm">No departments assigned</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell data-testid={`text-created-${user.id}`}>
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit?.(user)}
                        data-testid={`button-edit-${user.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onManageDepartments?.(user)}
                        data-testid={`button-departments-${user.id}`}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(user.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-${user.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
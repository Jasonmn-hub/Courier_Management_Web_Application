import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Plus, Download, Upload } from "lucide-react";
import UserForm from "@/components/users/user-form";
import UserTable from "@/components/users/user-table";
import UserDepartmentsDialog from "@/components/users/user-departments-dialog";
import { Input } from "@/components/ui/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function Users() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [managingUser, setManagingUser] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const bulkUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/users/bulk-upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Bulk upload failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: "Success",
        description: `Successfully processed ${data.processed || 0} users. ${data.errors ? `${data.errors} errors occurred.` : ''}`,
      });
      setSelectedFile(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to process bulk user upload",
        variant: "destructive",
      });
    },
  });

  const handleBulkUpload = () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a CSV file to upload",
        variant: "destructive",
      });
      return;
    }
    bulkUploadMutation.mutate(selectedFile);
  };

  const downloadTemplate = () => {
    // Create a CSV template with headers
    const headers = ['name', 'email', 'employeeCode', 'mobileNumber', 'role', 'departmentName', 'password'];
    const sampleData = [
      ['John Doe', 'john@example.com', 'EMP001', '9123456789', 'admin', 'IT Department', 'password123'],
      ['Jane Smith', 'jane@example.com', 'EMP002', '9876543210', 'sub_admin', 'HR Department', 'password456'],
      ['Mike Johnson', 'mike@example.com', 'EMP003', '9555666777', 'manager', 'Finance Department', 'password789'],
      ['Sarah Wilson', 'sarah@example.com', 'EMP004', '9444555666', 'user', 'Operations Department', 'password012']
    ];
    
    // Add comment row to explain valid roles
    const roleComment = ['# Valid roles: admin, sub_admin, manager, user', '', '', '', '', '', ''];
    
    const csvContent = [
      roleComment.join(','),
      headers.join(','),
      ...sampleData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'user_bulk_upload_template.csv';
    link.click();
  };

  // Redirect to home if not authenticated or not admin
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.role !== 'admin')) {
      toast({
        title: "Unauthorized",
        description: "You need admin privileges to access this page.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, user, toast]);

  if (isLoading || !isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <main className="flex-1 relative overflow-y-auto focus:outline-none">
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          {/* Page Header */}
          <div className="md:flex md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold leading-7 text-slate-900 sm:text-3xl sm:truncate">
                User Management
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Manage user accounts and role assignments
              </p>
            </div>
            <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-end space-y-3 md:space-y-0 md:space-x-3 md:mt-0 md:ml-4">
              <div className="flex flex-col space-y-2">
                <div className="flex space-x-3">
                  <Button 
                    variant="outline" 
                    onClick={downloadTemplate}
                    data-testid="button-download-template"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Template
                  </Button>
                  
                  <div className="flex items-center space-x-2">
                    <Input
                      type="file"
                      accept=".csv"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="csv-upload"
                    />
                    <label htmlFor="csv-upload">
                      <Button variant="outline" type="button" asChild>
                        <span className="cursor-pointer" data-testid="button-select-csv">
                          <Upload className="h-4 w-4 mr-2" />
                          Select CSV
                        </span>
                      </Button>
                    </label>
                    {selectedFile && (
                      <Button 
                        onClick={handleBulkUpload}
                        disabled={bulkUploadMutation.isPending}
                        data-testid="button-bulk-upload"
                      >
                        {bulkUploadMutation.isPending ? "Uploading..." : "Upload Users"}
                      </Button>
                    )}
                  </div>
                  
                  <Button 
                    onClick={() => setShowUserForm(true)}
                    data-testid="button-add-user"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </div>
                <div className="text-xs text-slate-500 md:text-right">
                  Valid roles: <code className="bg-slate-100 px-1 rounded">admin</code>, <code className="bg-slate-100 px-1 rounded">sub_admin</code>, <code className="bg-slate-100 px-1 rounded">manager</code>, <code className="bg-slate-100 px-1 rounded">user</code>
                </div>
              </div>
            </div>
          </div>

          {/* User Management Content */}
          <div className="mt-8">
            <UserTable 
              onEdit={(user) => {
                setEditingUser(user);
                setShowUserForm(true);
              }}
              onManageDepartments={(user) => {
                setManagingUser(user);
              }}
            />
          </div>
        </div>
      </div>

      {/* Add/Edit User Modal */}
      {showUserForm && (
        <UserForm
          user={editingUser}
          onClose={() => {
            setShowUserForm(false);
            setEditingUser(null);
          }}
          onSuccess={() => {
            setShowUserForm(false);
            setEditingUser(null);
            toast({
              title: "Success",
              description: `User ${editingUser ? 'updated' : 'created'} successfully`,
            });
          }}
        />
      )}

      {/* Manage User Departments Modal */}
      {managingUser && (
        <UserDepartmentsDialog
          user={managingUser}
          onClose={() => {
            setManagingUser(null);
          }}
          onSuccess={() => {
            setManagingUser(null);
            toast({
              title: "Success",
              description: "User departments updated successfully",
            });
          }}
        />
      )}
    </main>
  );
}

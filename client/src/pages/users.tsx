import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import UserForm from "@/components/users/user-form";
import UserTable from "@/components/users/user-table";
import UserDepartmentsDialog from "@/components/users/user-departments-dialog";

export default function Users() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [managingUser, setManagingUser] = useState<any>(null);

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
            <div className="mt-4 flex md:mt-0 md:ml-4">
              <Button 
                onClick={() => setShowUserForm(true)}
                data-testid="button-add-user"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add User
              </Button>
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

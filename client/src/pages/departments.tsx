import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import DepartmentForm from "@/components/departments/department-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Departments() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [showDepartmentForm, setShowDepartmentForm] = useState(false);

  // Redirect to home if not authenticated or not admin
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || (user && 'role' in user && user.role !== 'admin'))) {
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

  const { data: departments = [], isLoading: departmentsLoading } = useQuery<any[]>({
    queryKey: ['/api/departments'],
    enabled: isAuthenticated && user && 'role' in user && user.role === 'admin',
  });

  if (isLoading || !isAuthenticated || !user || !('role' in user) || user.role !== 'admin') {
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
                Department Management
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Manage departments and their field configurations
              </p>
            </div>
            <div className="mt-4 flex md:mt-0 md:ml-4">
              <Button 
                onClick={() => setShowDepartmentForm(true)}
                data-testid="button-add-department"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Department
              </Button>
            </div>
          </div>

          {/* Departments List */}
          <div className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle>Departments</CardTitle>
              </CardHeader>
              <CardContent>
                {departmentsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Created At</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {departments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8 text-slate-500">
                            No departments found. Create your first department to get started.
                          </TableCell>
                        </TableRow>
                      ) : (
                        departments.map((department: any) => (
                          <TableRow key={department.id}>
                            <TableCell className="font-medium" data-testid={`text-department-name-${department.id}`}>
                              {department.name}
                            </TableCell>
                            <TableCell data-testid={`text-department-created-${department.id}`}>
                              {new Date(department.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="outline" 
                                size="sm"
                                data-testid={`button-edit-department-${department.id}`}
                              >
                                Edit
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Add Department Modal */}
      {showDepartmentForm && (
        <DepartmentForm
          onClose={() => setShowDepartmentForm(false)}
          onSuccess={() => {
            setShowDepartmentForm(false);
            toast({
              title: "Success",
              description: "Department created successfully",
            });
          }}
        />
      )}
    </main>
  );
}

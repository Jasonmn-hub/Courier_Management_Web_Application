import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import DepartmentForm from "@/components/departments/department-form";
import PrintAuthorityForm from "@/components/print-authority/print-authority-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface User {
  id: string;
  role: string;
  email: string;
  name: string;
}

interface Department {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export default function Departments() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [showDepartmentForm, setShowDepartmentForm] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<any>(null);

  // Redirect to home if not authenticated or not admin
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || (user as User)?.role !== 'admin')) {
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

  const { data: departments = [], isLoading: departmentsLoading } = useQuery<Department[]>({
    queryKey: ['/api/departments'],
    enabled: isAuthenticated && (user as User)?.role === 'admin',
  });

  if (isLoading || !isAuthenticated || (user as User)?.role !== 'admin') {
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
          </div>

          {/* Tabs for Departments and Authority Letter */}
          <div className="mt-8">
            <Tabs defaultValue="departments" className="w-full">
              <TabsList className="flex w-full">
                <TabsTrigger value="departments" data-testid="tab-departments" className="flex-1">Departments</TabsTrigger>
                <TabsTrigger value="authority_letter" data-testid="tab-authority-letter" className="flex-1">Authority Letter</TabsTrigger>
              </TabsList>
              
              <TabsContent value="departments" className="mt-6">
                <div className="mb-6">
                  <Button 
                    onClick={() => setShowDepartmentForm(true)}
                    data-testid="button-add-department"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Department
                  </Button>
                </div>

                {/* Department List */}
                <Card>
                  <CardHeader>
                    <CardTitle>All Departments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {departmentsLoading ? (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : departments.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        No departments found. Add your first department to get started.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {departments.map((dept) => (
                            <TableRow key={dept.id}>
                              <TableCell className="font-medium">{dept.name}</TableCell>
                              <TableCell>
                                {new Date(dept.createdAt).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingDepartment(dept);
                                    setShowDepartmentForm(true);
                                  }}
                                  data-testid={`button-edit-${dept.id}`}
                                >
                                  Edit
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="authority_letter" className="mt-6">
                <PrintAuthorityForm />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Add/Edit Department Modal */}
      {showDepartmentForm && (
        <DepartmentForm
          department={editingDepartment}
          onClose={() => {
            setShowDepartmentForm(false);
            setEditingDepartment(null);
          }}
          onSuccess={() => {
            setShowDepartmentForm(false);
            setEditingDepartment(null);
          }}
        />
      )}
    </main>
  );
}
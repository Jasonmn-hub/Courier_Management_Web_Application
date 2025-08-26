import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Upload, Edit, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DepartmentForm from "@/components/departments/department-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiRequest } from "@/lib/queryClient";

interface User {
  id: string;
  role: string;
  email: string;
  name: string;
}

interface Department {
  id: number;
  name: string;
  authorityDocumentPath?: string;
  createdAt: string;
  updatedAt: string;
}

export default function Departments() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [showDepartmentForm, setShowDepartmentForm] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<any>(null);
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [selectedDepartmentForUpload, setSelectedDepartmentForUpload] = useState<Department | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

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

  // Upload document mutation
  const uploadDocumentMutation = useMutation({
    mutationFn: async ({ departmentId, file }: { departmentId: number; file: File }) => {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('departmentId', departmentId.toString());

      const response = await fetch('/api/departments/upload-document', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload document');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Authority document uploaded successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/departments'] });
      setShowDocumentUpload(false);
      setSelectedDepartmentForUpload(null);
      setUploadFile(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload document.",
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = () => {
    if (!uploadFile || !selectedDepartmentForUpload) return;
    
    // Validate file type
    if (!uploadFile.name.toLowerCase().endsWith('.docx') && !uploadFile.name.toLowerCase().endsWith('.doc')) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a Word document (.doc or .docx file).",
        variant: "destructive",
      });
      return;
    }

    uploadDocumentMutation.mutate({
      departmentId: selectedDepartmentForUpload.id,
      file: uploadFile,
    });
  };

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

          {/* Department Management */}
          <div className="mt-8">
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
                        <TableHead>Authority Document</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {departments.map((dept) => (
                        <TableRow key={dept.id}>
                          <TableCell className="font-medium">{dept.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              {dept.authorityDocumentPath ? (
                                <div className="flex items-center space-x-2">
                                  <FileText className="h-4 w-4 text-green-600" />
                                  <span className="text-sm text-green-600">Document uploaded</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedDepartmentForUpload(dept);
                                      setShowDocumentUpload(true);
                                    }}
                                    className="h-6 p-1"
                                    data-testid={`button-update-document-${dept.id}`}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedDepartmentForUpload(dept);
                                    setShowDocumentUpload(true);
                                  }}
                                  className="h-8"
                                  data-testid={`button-upload-document-${dept.id}`}
                                >
                                  <Upload className="h-3 w-3 mr-1" />
                                  Upload Document
                                </Button>
                              )}
                            </div>
                          </TableCell>
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
                              <Edit className="h-3 w-3 mr-1" />
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

      {/* Document Upload Modal */}
      {showDocumentUpload && selectedDepartmentForUpload && (
        <Dialog open={showDocumentUpload} onOpenChange={setShowDocumentUpload}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Upload Authority Document</DialogTitle>
              <DialogDescription>
                Upload a Word document template for {selectedDepartmentForUpload.name} department.
                This document will be used for generating authority letters.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="document-upload" className="text-right">
                  Document
                </label>
                <div className="col-span-3">
                  <Input
                    id="document-upload"
                    type="file"
                    accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setUploadFile(file);
                      }
                    }}
                    data-testid="input-document-upload"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Only Word documents (.doc, .docx) are allowed
                  </p>
                </div>
              </div>
              {uploadFile && (
                <div className="flex items-center space-x-2 p-2 bg-slate-50 rounded">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">{uploadFile.name}</span>
                  <span className="text-xs text-slate-500">
                    ({(uploadFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDocumentUpload(false);
                  setSelectedDepartmentForUpload(null);
                  setUploadFile(null);
                }}
                data-testid="button-cancel-upload"
              >
                Cancel
              </Button>
              <Button
                onClick={handleFileUpload}
                disabled={!uploadFile || uploadDocumentMutation.isPending}
                data-testid="button-confirm-upload"
              >
                {uploadDocumentMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-3 w-3 mr-2" />
                    Upload Document
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </main>
  );
}
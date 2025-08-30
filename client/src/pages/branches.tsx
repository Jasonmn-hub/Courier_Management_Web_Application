import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  MapPin, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Download,
  Upload,
  FileSpreadsheet,
  Archive,
  CheckCircle,
  XCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";

interface Branch {
  id: number;
  srNo?: number;
  branchName: string;
  branchCode: string;
  branchAddress: string;
  pincode: string;
  state: string;
  email?: string;
  latitude?: string;
  longitude?: string;
  status: 'active' | 'closed';
  createdAt?: string;
  updatedAt?: string;
}

export default function Branches() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<'active' | 'closed'>('active');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10); // 10 branches per page for better scrolling
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [exportType, setExportType] = useState<'all' | 'active' | 'closed'>('all');
  const [duplicateData, setDuplicateData] = useState<any>(null);

  const [formData, setFormData] = useState({
    branchName: '',
    branchCode: '',
    branchAddress: '',
    pincode: '',
    state: '',
    email: '',
    latitude: '',
    longitude: '',
    status: 'active' as 'active' | 'closed'
  });

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || (user as any)?.role !== 'admin')) {
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

  // Fetch Indian states
  const { data: statesData } = useQuery({
    queryKey: ['/api/states'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/states');
      return response.json();
    },
    enabled: isAuthenticated,
  });

  // Fetch branches with pagination
  const { data: branchesData, isLoading: branchesLoading, refetch: refetchBranches } = useQuery({
    queryKey: ['/api/branches', { status: activeTab, search: searchTerm, page: currentPage, pageSize }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('status', activeTab);
      if (searchTerm) params.set('search', searchTerm);
      params.set('limit', pageSize.toString());
      params.set('offset', ((currentPage - 1) * pageSize).toString());
      
      const response = await apiRequest('GET', `/api/branches?${params.toString()}`);
      return response.json();
    },
    enabled: isAuthenticated && (user as any)?.role === 'admin',
  });

  const branches = branchesData?.branches || [];
  const totalBranches = branchesData?.total || 0;

  // Create branch mutation
  const createBranchMutation = useMutation({
    mutationFn: async (branchData: any) => {
      const response = await apiRequest('POST', '/api/branches', branchData);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Branch created successfully" });
      refetchBranches();
      resetForm();
      setShowBranchForm(false);
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/api/login";
        return;
      }
      toast({ title: "Error", description: "Failed to create branch", variant: "destructive" });
    },
  });

  // Update branch mutation
  const updateBranchMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await apiRequest('PUT', `/api/branches/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Branch updated successfully" });
      refetchBranches();
      resetForm();
      setShowBranchForm(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: "Failed to update branch", variant: "destructive" });
    },
  });

  // Delete branch mutation
  const deleteBranchMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/branches/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Branch deleted successfully" });
      refetchBranches();
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
      toast({ title: "Error", description: "Failed to delete branch", variant: "destructive" });
    },
  });

  // Update branch status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: 'active' | 'closed' }) => {
      const response = await apiRequest('PATCH', `/api/branches/${id}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Branch status updated successfully" });
      refetchBranches();
      queryClient.invalidateQueries({ queryKey: ['/api/branches'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: "Failed to update branch status", variant: "destructive" });
    },
  });

  // Bulk upload mutation
  const bulkUploadMutation = useMutation({
    mutationFn: async ({ file, adminApproval = false }: { file: File; adminApproval?: boolean }) => {
      const formData = new FormData();
      formData.append('csvFile', file);
      if (adminApproval) {
        formData.append('adminApproval', 'true');
      }

      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/branches/bulk-upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 409 && data.requiresApproval) {
          // Duplicate entries found, return data for admin approval
          return { requiresApproval: true, ...data };
        }
        throw new Error(data.message || 'Failed to upload branches');
      }

      return data;
    },
    onSuccess: (data) => {
      if (data.requiresApproval) {
        // Show duplicate confirmation dialog
        setDuplicateData(data);
        setShowDuplicateDialog(true);
      } else {
        toast({ title: "Success", description: data.message });
        refetchBranches();
        setShowBulkUpload(false);
        setCsvFile(null);
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to upload branches", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      branchName: '',
      branchCode: '',
      branchAddress: '',
      pincode: '',
      state: '',
      email: '',
      latitude: '',
      longitude: '',
      status: 'active'
    });
    setEditingBranch(null);
  };

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm]);

  // Handle page change with proper validation
  const handlePageChange = (newPage: number) => {
    const totalPages = Math.ceil(totalBranches / pageSize);
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setFormData({
      branchName: branch.branchName,
      branchCode: branch.branchCode,
      branchAddress: branch.branchAddress,
      pincode: branch.pincode,
      state: branch.state,
      email: branch.email || '',
      latitude: branch.latitude || '',
      longitude: branch.longitude || '',
      status: branch.status
    });
    setShowBranchForm(true);
  };

  const handleSubmit = () => {
    const branchData = {
      ...formData,
    };

    if (editingBranch) {
      updateBranchMutation.mutate({ id: editingBranch.id, data: branchData });
    } else {
      createBranchMutation.mutate(branchData);
    }
  };

  const handleStatusChange = (branch: Branch, newStatus: 'active' | 'closed') => {
    updateStatusMutation.mutate({ id: branch.id, status: newStatus });
  };

  const handleDownloadSample = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/branches/sample-csv', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to download sample CSV');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'branch_sample.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({ title: "Success", description: "Sample CSV downloaded" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to download sample CSV", variant: "destructive" });
    }
  };

  const handleExport = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/branches/export?status=${exportType}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to export branches');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exportType}_branches.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({ title: "Success", description: `${exportType} branches exported successfully` });
      setShowExportDialog(false);
    } catch (error) {
      toast({ title: "Error", description: "Failed to export branches", variant: "destructive" });
    }
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Branch Management</h1>
          <p className="text-slate-600 mt-1">Manage your organization's branches</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setShowExportDialog(true)} variant="outline" data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setShowBulkUpload(true)} variant="outline" data-testid="button-bulk-upload">
            <Upload className="h-4 w-4 mr-2" />
            Bulk Upload
          </Button>
          <Button onClick={() => setShowBranchForm(true)} data-testid="button-add-branch">
            <Plus className="h-4 w-4 mr-2" />
            Add Branch
          </Button>
        </div>
      </div>

      {/* Search and Stats */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Search branches..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-branches"
              />
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-600">
              <span>Total: {totalBranches} branches</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Active/Closed */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'active' | 'closed')}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="active" className="flex items-center gap-2" data-testid="tab-active">
            <CheckCircle className="h-4 w-4" />
            Active Branches
          </TabsTrigger>
          <TabsTrigger value="closed" className="flex items-center gap-2" data-testid="tab-closed">
            <XCircle className="h-4 w-4" />
            Closed Branches
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          <BranchesTable 
            branches={branches} 
            onEdit={handleEdit} 
            onDelete={(id) => deleteBranchMutation.mutate(id)} 
            onStatusChange={handleStatusChange}
            isLoading={branchesLoading}
            showStatusActions={true}
          />
          {/* Pagination Controls */}
          <PaginationControls 
            currentPage={currentPage}
            totalItems={totalBranches}
            pageSize={pageSize}
            onPageChange={handlePageChange}
          />
        </TabsContent>

        <TabsContent value="closed" className="space-y-4">
          <BranchesTable 
            branches={branches} 
            onEdit={handleEdit} 
            onDelete={(id) => deleteBranchMutation.mutate(id)} 
            onStatusChange={handleStatusChange}
            isLoading={branchesLoading}
            showStatusActions={true}
          />
          {/* Pagination Controls */}
          <PaginationControls 
            currentPage={currentPage}
            totalItems={totalBranches}
            pageSize={pageSize}
            onPageChange={handlePageChange}
          />
        </TabsContent>
      </Tabs>

      {/* Add/Edit Branch Modal */}
      {showBranchForm && (
        <Dialog open={showBranchForm} onOpenChange={setShowBranchForm}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingBranch ? 'Edit Branch' : 'Add New Branch'}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Sr. No</Label>
                <Input
                  value="Auto-generated"
                  disabled
                  className="bg-slate-50 text-slate-500"
                  data-testid="input-sr-no"
                />
              </div>
              <div>
                <Label htmlFor="branchName">Branch Name *</Label>
                <Input
                  id="branchName"
                  value={formData.branchName}
                  onChange={(e) => setFormData({...formData, branchName: e.target.value})}
                  placeholder="Branch name"
                  required
                  data-testid="input-branch-name"
                />
              </div>
              <div>
                <Label htmlFor="branchCode">Branch Code *</Label>
                <Input
                  id="branchCode"
                  value={formData.branchCode}
                  onChange={(e) => setFormData({...formData, branchCode: e.target.value})}
                  placeholder="Unique branch code"
                  required
                  data-testid="input-branch-code"
                />
              </div>
              <div>
                <Label htmlFor="state">State *</Label>
                <Select
                  value={formData.state}
                  onValueChange={(value) => setFormData({...formData, state: value})}
                >
                  <SelectTrigger data-testid="select-state">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {statesData?.states?.map((state: string) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label htmlFor="branchAddress">Branch Address *</Label>
                <Input
                  id="branchAddress"
                  value={formData.branchAddress}
                  onChange={(e) => setFormData({...formData, branchAddress: e.target.value})}
                  placeholder="Complete branch address"
                  required
                  data-testid="input-branch-address"
                />
              </div>
              <div>
                <Label htmlFor="pincode">Pincode *</Label>
                <Input
                  id="pincode"
                  value={formData.pincode}
                  onChange={(e) => setFormData({...formData, pincode: e.target.value})}
                  placeholder="PIN code"
                  required
                  data-testid="input-pincode"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="branch@example.com (optional)"
                  data-testid="input-email"
                />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({...formData, status: value as 'active' | 'closed'})}
                >
                  <SelectTrigger data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  value={formData.latitude}
                  onChange={(e) => setFormData({...formData, latitude: e.target.value})}
                  placeholder="Latitude (optional)"
                  data-testid="input-latitude"
                />
              </div>
              <div>
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  value={formData.longitude}
                  onChange={(e) => setFormData({...formData, longitude: e.target.value})}
                  placeholder="Longitude (optional)"
                  data-testid="input-longitude"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {resetForm(); setShowBranchForm(false);}} data-testid="button-cancel">
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={createBranchMutation.isPending || updateBranchMutation.isPending}
                data-testid="button-save-branch"
              >
                {createBranchMutation.isPending || updateBranchMutation.isPending ? 'Saving...' : 'Save Branch'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Bulk Upload Modal */}
      {showBulkUpload && (
        <Dialog open={showBulkUpload} onOpenChange={setShowBulkUpload}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bulk Upload Branches</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">How to bulk upload:</h4>
                <ol className="text-sm text-blue-800 space-y-1">
                  <li>1. Download the sample CSV file</li>
                  <li>2. Fill in your branch data following the sample format</li>
                  <li>3. Upload your completed CSV file</li>
                  <li>4. Click "Upload" to process the data</li>
                </ol>
              </div>

              <Button onClick={handleDownloadSample} variant="outline" className="w-full" data-testid="button-download-sample">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Download Sample CSV
              </Button>

              <div>
                <Label htmlFor="csv-file">Upload CSV File</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setCsvFile(file);
                  }}
                  data-testid="input-csv-file"
                />
                {csvFile && (
                  <p className="text-sm text-green-600 mt-1">
                    Selected: {csvFile.name} ({(csvFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBulkUpload(false)} data-testid="button-cancel-upload">
                Cancel
              </Button>
              <Button 
                onClick={() => csvFile && bulkUploadMutation.mutate({ file: csvFile })}
                disabled={!csvFile || bulkUploadMutation.isPending}
                data-testid="button-upload-csv"
              >
                {bulkUploadMutation.isPending ? 'Uploading...' : 'Upload'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Export Dialog */}
      {showExportDialog && (
        <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Export Branches</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Export Type</Label>
                <Select
                  value={exportType}
                  onValueChange={(value) => setExportType(value as 'all' | 'active' | 'closed')}
                >
                  <SelectTrigger data-testid="select-export-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    <SelectItem value="active">Active Branches Only</SelectItem>
                    <SelectItem value="closed">Closed Branches Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowExportDialog(false)} data-testid="button-cancel-export">
                Cancel
              </Button>
              <Button onClick={handleExport} data-testid="button-confirm-export">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Duplicate Confirmation Dialog */}
      {showDuplicateDialog && duplicateData && (
        <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Duplicate Entries Found</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                The following duplicate entries were found in your CSV file. Do you want to proceed anyway?
              </p>
              
              <div className="max-h-60 overflow-y-auto border rounded-lg p-4 bg-slate-50">
                {duplicateData.duplicates?.map((duplicate: any, index: number) => (
                  <div key={index} className="mb-2 p-2 bg-white border rounded text-sm">
                    <span className="font-medium text-red-600">Row {duplicate.row}:</span> 
                    <span className="ml-2">{duplicate.message}</span>
                    <div className="text-slate-500 mt-1">
                      {duplicate.field}: {duplicate.value}
                    </div>
                  </div>
                ))}
              </div>

              {duplicateData.validationErrors?.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Validation Errors:</p>
                  <div className="max-h-40 overflow-y-auto border rounded-lg p-4 bg-red-50">
                    {duplicateData.validationErrors.map((error: any, index: number) => (
                      <div key={index} className="mb-2 text-sm text-red-700">
                        <span className="font-medium">Row {error.row}:</span>
                        <ul className="ml-4 list-disc">
                          {error.errors.map((err: string, errIndex: number) => (
                            <li key={errIndex}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDuplicateDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  if (csvFile) {
                    bulkUploadMutation.mutate({ file: csvFile, adminApproval: true });
                  }
                  setShowDuplicateDialog(false);
                }}
                variant="destructive"
              >
                Proceed with Duplicates
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function BranchesTable({ 
  branches, 
  onEdit, 
  onDelete, 
  onStatusChange, 
  isLoading,
  showStatusActions = false
}: {
  branches: Branch[];
  onEdit: (branch: Branch) => void;
  onDelete: (id: number) => void;
  onStatusChange: (branch: Branch, status: 'active' | 'closed') => void;
  isLoading: boolean;
  showStatusActions?: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (branches.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <MapPin className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-4 text-lg font-medium text-slate-900">No branches found</h3>
          <p className="mt-2 text-slate-500">
            Add your first branch to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sr. No</TableHead>
                <TableHead>Branch Name</TableHead>
                <TableHead>Branch Code</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Pincode</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.map((branch) => (
                <TableRow key={branch.id} data-testid={`row-branch-${branch.id}`}>
                  <TableCell>{branch.srNo || '-'}</TableCell>
                  <TableCell className="font-medium">{branch.branchName}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{branch.branchCode}</Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate" title={branch.branchAddress}>
                    {branch.branchAddress}
                  </TableCell>
                  <TableCell>{branch.pincode}</TableCell>
                  <TableCell>{branch.state}</TableCell>
                  <TableCell>
                    {branch.latitude && branch.longitude ? (
                      <a
                        href={`https://maps.google.com/?q=${branch.latitude},${branch.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-blue-600 hover:text-blue-800"
                        data-testid={`link-location-${branch.id}`}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={branch.status === 'active' ? 'default' : 'secondary'}>
                      {branch.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => onEdit(branch)}
                        data-testid={`button-edit-${branch.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {showStatusActions && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onStatusChange(branch, branch.status === 'active' ? 'closed' : 'active')}
                          title={branch.status === 'active' ? 'Mark as Closed' : 'Mark as Active'}
                          data-testid={`button-toggle-status-${branch.id}`}
                        >
                          {branch.status === 'active' ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => onDelete(branch.id)}
                        className="text-red-600 hover:text-red-800"
                        data-testid={`button-delete-${branch.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// Pagination Controls Component
function PaginationControls({ 
  currentPage, 
  totalItems, 
  pageSize, 
  onPageChange 
}: {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.ceil(totalItems / pageSize);
  
  if (totalPages <= 1) return null;
  
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200">
      <div className="flex items-center text-sm text-gray-700">
        Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems} branches
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          data-testid="button-previous-page"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>
        <span className="text-sm text-gray-700">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          data-testid="button-next-page"
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
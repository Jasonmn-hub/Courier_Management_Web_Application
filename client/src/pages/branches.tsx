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
  ExternalLink
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
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [exportType, setExportType] = useState<'all' | 'active' | 'closed'>('all');

  const [formData, setFormData] = useState({
    srNo: '',
    branchName: '',
    branchCode: '',
    branchAddress: '',
    pincode: '',
    state: '',
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

  // Fetch branches
  const { data: branchesData, isLoading: branchesLoading, refetch: refetchBranches } = useQuery({
    queryKey: ['/api/branches', { status: activeTab, search: searchTerm }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('status', activeTab);
      if (searchTerm) params.set('search', searchTerm);
      
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
    },
    onError: (error: any) => {
      toast({ title: "Error", description: "Failed to update branch status", variant: "destructive" });
    },
  });

  // Bulk upload mutation
  const bulkUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('csvFile', file);

      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/branches/bulk-upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload branches');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: data.message });
      refetchBranches();
      setShowBulkUpload(false);
      setCsvFile(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: "Failed to upload branches", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      srNo: '',
      branchName: '',
      branchCode: '',
      branchAddress: '',
      pincode: '',
      state: '',
      latitude: '',
      longitude: '',
      status: 'active'
    });
    setEditingBranch(null);
  };

  const handleEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setFormData({
      srNo: branch.srNo?.toString() || '',
      branchName: branch.branchName,
      branchCode: branch.branchCode,
      branchAddress: branch.branchAddress,
      pincode: branch.pincode,
      state: branch.state,
      latitude: branch.latitude || '',
      longitude: branch.longitude || '',
      status: branch.status
    });
    setShowBranchForm(true);
  };

  const handleSubmit = () => {
    const branchData = {
      ...formData,
      srNo: formData.srNo ? parseInt(formData.srNo) : undefined,
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
                <Label htmlFor="srNo">Sr. No</Label>
                <Input
                  id="srNo"
                  type="number"
                  value={formData.srNo}
                  onChange={(e) => setFormData({...formData, srNo: e.target.value})}
                  placeholder="Serial number"
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
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => setFormData({...formData, state: e.target.value})}
                  placeholder="State"
                  required
                  data-testid="input-state"
                />
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
                onClick={() => csvFile && bulkUploadMutation.mutate(csvFile)}
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
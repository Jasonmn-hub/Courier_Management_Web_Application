import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Edit, Eye, Trash2, RotateCcw, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { formatEntityId } from "@/lib/idUtils";

interface CourierTableProps {
  title?: string;
  status?: string;
  limit?: number;
  onEdit?: (courier: any) => void;
  showRestore?: boolean;
}

export default function CourierTable({ 
  title = "Couriers", 
  status, 
  limit, 
  onEdit, 
  showRestore = false 
}: CourierTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(limit || 10);
  const [currentPage, setCurrentPage] = useState(1);
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState(status || "all");
  const [viewingCourier, setViewingCourier] = useState<any>(null);

  const { data: couriersResult, isLoading } = useQuery({
    queryKey: ['/api/couriers', statusFilter, search, pageSize, currentPage, departmentFilter],
    refetchInterval: 8000, // Refresh every 8 seconds for real-time updates
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append('status', statusFilter);
      if (search) params.append('search', search);
      params.append('limit', pageSize.toString());
      params.append('offset', ((currentPage - 1) * pageSize).toString());
      if (departmentFilter !== "all") params.append('departmentId', departmentFilter);
      
      const url = `/api/couriers${params.toString() ? '?' + params.toString() : ''}`;
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
  });

  const { data: departments } = useQuery({
    queryKey: ['/api/departments'],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/couriers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/couriers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats/monthly'] });
      toast({
        title: "Success",
        description: "Courier deleted successfully",
      });
    },
    onError: (error) => {
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
      toast({
        title: "Error",
        description: "Failed to delete courier",
        variant: "destructive",
      });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('POST', `/api/couriers/${id}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/couriers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats/monthly'] });
      toast({
        title: "Success",
        description: "Courier restored successfully",
      });
    },
    onError: (error) => {
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
      toast({
        title: "Error",
        description: "Failed to restore courier",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this courier?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleRestore = (id: number) => {
    if (confirm("Are you sure you want to restore this courier?")) {
      restoreMutation.mutate(id);
    }
  };

  const markAsReceivedMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('PATCH', `/api/couriers/${id}`, { status: 'received', receivedDate: new Date().toISOString().split('T')[0] });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/couriers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats/monthly'] });
      toast({
        title: "Success",
        description: "Courier marked as received",
      });
    },
    onError: (error) => {
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
      toast({
        title: "Error",
        description: "Failed to update courier status",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'on_the_way':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">On The Way</Badge>;
      case 'received':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Delivered</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Delivered</Badge>;
      case 'deleted':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Deleted</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const totalPages = Math.ceil(((couriersResult as any)?.total || 0) / pageSize);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              {status ? `${status.replace('_', ' ')} couriers` : 'All courier entries and their current status'}
            </p>
          </div>
          
          {/* Filters */}
          <div className="flex items-center space-x-3">
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
              data-testid="input-search-couriers"
            />
            
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-48" data-testid="select-department-filter">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {Array.isArray(departments) ? departments.map((dept: any) => (
                  <SelectItem key={dept.id} value={dept.id.toString()}>
                    {dept.name}
                  </SelectItem>
                )) : null}
              </SelectContent>
            </Select>

            {!status && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40" data-testid="select-status-filter">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="on_the_way">On The Way</SelectItem>
                  <SelectItem value="received">Delivered</SelectItem>
                  <SelectItem value="completed">Delivered</SelectItem>
                  <SelectItem value="deleted">Deleted</SelectItem>
                </SelectContent>
              </Select>
            )}

            <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(parseInt(value))}>
              <SelectTrigger className="w-40" data-testid="select-page-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 per page</SelectItem>
                <SelectItem value="20">20 per page</SelectItem>
                <SelectItem value="50">50 per page</SelectItem>
                <SelectItem value="100">100 per page</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>POD No.</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((couriersResult as any)?.couriers?.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                        No couriers found. {!status && "Create your first courier to get started."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    (couriersResult as any)?.couriers?.map((courier: any) => (
                      <TableRow key={courier.id} className="hover:bg-slate-50">
                        <TableCell className="font-medium" data-testid={`text-pod-${courier.id}`}>
                          {courier.podNo}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{courier.toBranch}</div>
                            <div className="text-slate-400 text-sm">{courier.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>{courier.vendor}</TableCell>
                        <TableCell>
                          {courier.courierDate ? new Date(courier.courierDate).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                              {courier.department?.name || 'N/A'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(courier.status)}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            {onEdit && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => onEdit(courier)}
                                data-testid={`button-edit-${courier.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setViewingCourier(courier)}
                              data-testid={`button-view-${courier.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            
                            {courier.status === 'on_the_way' && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => markAsReceivedMutation.mutate(courier.id)}
                                disabled={markAsReceivedMutation.isPending}
                                data-testid={`button-received-${courier.id}`}
                                title="Mark as Received"
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                            )}
                            
                            {showRestore ? (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleRestore(courier.id)}
                                disabled={restoreMutation.isPending}
                                data-testid={`button-restore-${courier.id}`}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleDelete(courier.id)}
                                disabled={deleteMutation.isPending}
                                data-testid={`button-delete-${courier.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-6 border-t border-slate-200">
                <div className="flex-1 flex justify-between sm:hidden">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    data-testid="button-prev-mobile"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    data-testid="button-next-mobile"
                  >
                    Next
                  </Button>
                </div>
                
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-slate-700">
                      Showing <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> to{' '}
                      <span className="font-medium">
                        {Math.min(currentPage * pageSize, (couriersResult as any)?.total || 0)}
                      </span>{' '}
                      of <span className="font-medium">{(couriersResult as any)?.total || 0}</span> results
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      data-testid="button-prev"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    <span className="text-sm text-slate-700">
                      Page {currentPage} of {totalPages}
                    </span>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      data-testid="button-next"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
      
      {/* View Courier Details Modal */}
      {viewingCourier && (
        <Dialog open={true} onOpenChange={() => setViewingCourier(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Courier Details</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">POD No.</label>
                  <p className="text-sm text-gray-900">{viewingCourier.podNo || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">To Branch</label>
                  <p className="text-sm text-gray-900">{viewingCourier.toBranch || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <p className="text-sm text-gray-900">{viewingCourier.email || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Vendor</label>
                  <p className="text-sm text-gray-900">
                    {viewingCourier.vendor === 'Others' && viewingCourier.customVendor 
                      ? viewingCourier.customVendor 
                      : viewingCourier.vendor || '-'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Courier Date</label>
                  <p className="text-sm text-gray-900">
                    {viewingCourier.courierDate ? new Date(viewingCourier.courierDate).toLocaleDateString() : '-'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  <div className="mt-1">{getStatusBadge(viewingCourier.status)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Department</label>
                  <p className="text-sm text-gray-900">{viewingCourier.department?.name || 'N/A'}</p>
                </div>
                {viewingCourier.receiverName && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Receiver Name</label>
                    <p className="text-sm text-gray-900">{viewingCourier.receiverName}</p>
                  </div>
                )}
                {viewingCourier.receivedDate && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Received Date</label>
                    <p className="text-sm text-gray-900">
                      {new Date(viewingCourier.receivedDate).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
              
              {viewingCourier.details && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Details</label>
                  <p className="text-sm text-gray-900 mt-1">{viewingCourier.details}</p>
                </div>
              )}
              
              {viewingCourier.contactDetails && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Contact Details</label>
                  <p className="text-sm text-gray-900 mt-1">{viewingCourier.contactDetails}</p>
                </div>
              )}
              
              {viewingCourier.remarks && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Remarks</label>
                  <p className="text-sm text-gray-900 mt-1">{viewingCourier.remarks}</p>
                </div>
              )}
              
              {viewingCourier.receivedRemarks && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Received Remarks</label>
                  <p className="text-sm text-gray-900 mt-1">{viewingCourier.receivedRemarks}</p>
                </div>
              )}
              
              {/* POD Copy Attachment Section */}
              {viewingCourier.podCopyPath && (
                <div>
                  <label className="text-sm font-medium text-gray-700">POD Copy Attachment</label>
                  <div className="mt-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = `/uploads/${viewingCourier.podCopyPath}`;
                        link.download = viewingCourier.podCopyPath;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="text-blue-600 border-blue-600 hover:bg-blue-50"
                    >
                      📎 Download POD Copy
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Creator Information */}
              {viewingCourier.creator && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Created By</label>
                  <p className="text-sm text-gray-900 mt-1">
                    {viewingCourier.creator.name || viewingCourier.creator.email}
                    {viewingCourier.creator.employeeCode && (
                      <span className="text-gray-500"> ({viewingCourier.creator.employeeCode})</span>
                    )}
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex justify-end pt-4">
              <Button onClick={() => setViewingCourier(null)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

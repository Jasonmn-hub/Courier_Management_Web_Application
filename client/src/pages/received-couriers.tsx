import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Plus, Mail, Eye } from "lucide-react";
import { Autocomplete } from "@/components/ui/autocomplete";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon, Search } from "lucide-react";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { ReceivedCourier, InsertReceivedCourier } from "@shared/schema";
import { formatEntityId } from "@/lib/idUtils";

interface User {
  id: string;
  role: string;
  email: string;
  name: string;
}

interface Department {
  id: number;
  name: string;
}

export default function ReceivedCouriers() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewingCourier, setViewingCourier] = useState<any>(null);
  const [formData, setFormData] = useState<Partial<InsertReceivedCourier>>({
    podNumber: "",
    receivedDate: "",
    fromLocation: "",
    courierVendor: "",
    customVendor: "",
    departmentId: undefined,
    customDepartment: "",
    receiverName: "",
    emailId: "",
    sendEmailNotification: false,
    remarks: "",
  });
  const [selectedDate, setSelectedDate] = useState<Date>();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
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
  }, [isAuthenticated, isLoading, toast]);

  const { data: allReceivedCouriers = [], isLoading: couriersLoading } = useQuery<ReceivedCourier[]>({
    queryKey: ['/api/received-couriers'],
    enabled: isAuthenticated,
  });

  // Filter received couriers on the client side
  const receivedCouriers = allReceivedCouriers.filter((courier) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      courier.podNumber?.toLowerCase().includes(searchLower) ||
      (courier as any).receiverName?.toLowerCase().includes(searchLower) ||
      courier.courierVendor?.toLowerCase().includes(searchLower) ||
      (courier as any).customVendor?.toLowerCase().includes(searchLower) ||
      courier.fromLocation?.toLowerCase().includes(searchLower) ||
      (courier as any).departmentName?.toLowerCase().includes(searchLower) ||
      (courier as any).customDepartment?.toLowerCase().includes(searchLower)
    );
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['/api/departments'],
    enabled: isAuthenticated,
  });

  // Fetch branches for autocomplete
  const { data: branchesData } = useQuery({
    queryKey: ['/api/branches', { status: 'active', limit: 1000 }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('status', 'active');
      params.set('limit', '1000'); // Get all branches for autocomplete
      const response = await apiRequest('GET', `/api/branches?${params.toString()}`);
      return response.json();
    },
    enabled: isAuthenticated,
  });

  // Fetch users for autocomplete
  const { data: usersData } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/users');
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertReceivedCourier) => {
      const res = await apiRequest('POST', '/api/received-couriers', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/received-couriers'] });
      toast({ title: "Success", description: "Received courier added successfully" });
      setShowForm(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add received courier", variant: "destructive" });
    },
  });

  const dispatchMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('POST', `/api/received-couriers/${id}/dispatch`, {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/received-couriers'] });
      toast({ 
        title: "Success", 
        description: data.message || "Courier dispatched and email sent successfully" 
      });
    },
    onError: () => {
      toast({ 
        title: "Error", 
        description: "Failed to dispatch courier", 
        variant: "destructive" 
      });
    },
  });

  const resetForm = () => {
    setFormData({
      podNumber: "",
      receivedDate: "",
      fromLocation: "",
      courierVendor: "",
      customVendor: "",
      departmentId: undefined,
      customDepartment: "",
      receiverName: "",
      emailId: "",
      sendEmailNotification: false,
      remarks: "",
    });
    setSelectedDate(undefined);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.podNumber || !selectedDate || !formData.fromLocation || !formData.courierVendor) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    const submitData: InsertReceivedCourier = {
      ...formData,
      receivedDate: format(selectedDate, "yyyy-MM-dd"),
      createdBy: (user as User)?.id,
      departmentId: null, // Will be assigned based on user's department or admin selection
    } as InsertReceivedCourier;

    createMutation.mutate(submitData);
  };

  if (isLoading || !isAuthenticated) {
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
                Received Couriers
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Manage and track all received courier shipments
              </p>
            </div>
            <div className="mt-4 flex md:mt-0 md:ml-4">
              <Button 
                onClick={() => setShowForm(true)}
                data-testid="button-add-received-courier"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Received Courier
              </Button>
            </div>
          </div>

          {/* Received Couriers List */}
          <div className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle>All Received Couriers</CardTitle>
                
                {/* Search Input */}
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <Input
                    placeholder="Search received couriers by POD number, receiver, or vendor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-received-couriers"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {couriersLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : receivedCouriers.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    No received couriers found. Add your first received courier to get started.
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>POD Number</TableHead>
                        <TableHead>Received Date</TableHead>
                        <TableHead>From</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Receiver</TableHead>
                        <TableHead>Courier Vendor</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Remarks</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receivedCouriers.map((courier) => (
                        <TableRow key={courier.id}>
                          <TableCell className="font-medium" data-testid={`text-pod-${courier.id}`}>
                            {courier.podNumber}
                          </TableCell>
                          <TableCell data-testid={`text-received-date-${courier.id}`}>
                            {courier.receivedDate ? new Date(courier.receivedDate + 'T00:00:00').toLocaleDateString() : '-'}
                          </TableCell>
                          <TableCell data-testid={`text-from-${courier.id}`}>
                            {courier.fromLocation}
                          </TableCell>
                          <TableCell data-testid={`text-department-${courier.id}`}>
                            {(courier as any).departmentName || (courier as any).customDepartment || '-'}
                          </TableCell>
                          <TableCell data-testid={`text-receiver-${courier.id}`}>
                            {(courier as any).receiverName || '-'}
                          </TableCell>
                          <TableCell data-testid={`text-vendor-${courier.id}`}>
                            {courier.courierVendor === 'Others' && (courier as any).customVendor 
                              ? (courier as any).customVendor 
                              : courier.courierVendor}
                          </TableCell>
                          <TableCell data-testid={`text-email-${courier.id}`}>
                            {(courier as any).emailId || '-'}
                            {(courier as any).sendEmailNotification && (courier as any).emailId && (
                              <span className="ml-1 text-green-600">📧</span>
                            )}
                          </TableCell>
                          <TableCell data-testid={`text-status-${courier.id}`}>
                            <div className="flex flex-col gap-1">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                (courier as any).status === 'received' 
                                  ? 'bg-green-100 text-green-800' 
                                  : (courier as any).status === 'dispatched'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {(courier as any).status === 'received' ? 'Confirmed Received' : 
                                 (courier as any).status === 'dispatched' ? 'Dispatched' : 'Pending'}
                              </span>
                              {(courier as any).status === 'received' && (
                                <span className="text-xs text-green-600 font-medium">
                                  ✅ Confirmed via Email
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell data-testid={`text-remarks-${courier.id}`}>
                            {courier.remarks || '-'}
                          </TableCell>
                          <TableCell data-testid={`actions-${courier.id}`}>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setViewingCourier(courier)}
                                data-testid={`button-view-${courier.id}`}
                                className="text-blue-600 border-blue-600 hover:bg-blue-50"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              
                              {(courier as any).emailId && (courier as any).status !== 'dispatched' && (courier as any).status !== 'received' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => dispatchMutation.mutate(courier.id)}
                                  disabled={dispatchMutation.isPending}
                                  data-testid={`button-dispatch-${courier.id}`}
                                  className="text-green-600 border-green-600 hover:bg-green-50"
                                >
                                  <Mail className="h-4 w-4 mr-1" />
                                  {dispatchMutation.isPending ? 'Sending...' : 'Dispatch'}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Add Received Courier Modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Received Courier</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              {/* Related Department - First Field */}
              <div>
                <Label htmlFor="department">Related Department *</Label>
                <Select
                  value={formData.departmentId?.toString() || ""}
                  onValueChange={(value) => {
                    if (value === "other") {
                      setFormData({ ...formData, departmentId: undefined });
                    } else {
                      setFormData({ ...formData, departmentId: parseInt(value), customDepartment: "" });
                    }
                  }}
                >
                  <SelectTrigger data-testid="select-department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id.toString()}>
                        {dept.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* From (Branch/Other) - Second Field */}
              <div>
                <Label htmlFor="fromLocation">From (Branch/Other) *</Label>
                <Autocomplete
                  value={formData.fromLocation || ""}
                  onChange={(value) => {
                    setFormData({ ...formData, fromLocation: value });
                    // Auto-fill email if branch is selected
                    const selectedBranch = branchesData?.branches?.find((b: any) => 
                      b.branchName === value || `${b.branchName} (${b.branchCode})` === value
                    );
                    if (selectedBranch && selectedBranch.email) {
                      setFormData(prev => ({ ...prev, emailId: selectedBranch.email, sendEmailNotification: true }));
                    } else {
                      // Check if it's a user
                      const selectedUser = usersData?.users?.find((u: any) => 
                        u.name === value || u.email === value
                      );
                      if (selectedUser && selectedUser.email) {
                        setFormData(prev => ({ ...prev, emailId: selectedUser.email, sendEmailNotification: true }));
                      }
                    }
                  }}
                  options={[
                    ...(branchesData?.branches || []).map((branch: any) => ({
                      value: branch.branchName,
                      label: `${branch.branchName} - ${branch.email || 'No Email'}`
                    })),
                    ...(usersData?.users || []).map((user: any) => ({
                      value: user.name || user.email,
                      label: `${user.name} - ${user.email}`
                    }))
                  ]}
                  placeholder="Type branch name, user name, or custom location..."
                  onAddNew={(value) => {
                    setFormData({ ...formData, fromLocation: value });
                    toast({ 
                      title: "Custom Location", 
                      description: `Using custom location: ${value}` 
                    });
                  }}
                  data-testid="autocomplete-from-location"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Type to search for existing branches/users or enter a custom location
                </div>
              </div>

              {/* Received Date - Third Field */}
              <div>
                <Label>Received Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground"
                      )}
                      data-testid="button-received-date"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* POD Number - Fourth Field */}
              <div>
                <Label htmlFor="podNumber">POD Number *</Label>
                <Input
                  id="podNumber"
                  value={formData.podNumber || ""}
                  onChange={(e) => setFormData({ ...formData, podNumber: e.target.value })}
                  placeholder="Enter POD Number"
                  required
                  data-testid="input-pod-number"
                />
              </div>

              {/* Courier Vendor - Fifth Field */}
              <div>
                <Label htmlFor="courierVendor">Courier Vendor *</Label>
                <Select
                  value={formData.courierVendor || ""}
                  onValueChange={(value) => setFormData({ ...formData, courierVendor: value })}
                >
                  <SelectTrigger data-testid="select-courier-vendor">
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Maruti Courier">Maruti Courier</SelectItem>
                    <SelectItem value="India Post">India Post</SelectItem>
                    <SelectItem value="Professional Couriers">Professional Couriers</SelectItem>
                    <SelectItem value="Blue Dart">Blue Dart</SelectItem>
                    <SelectItem value="DHL Express">DHL Express</SelectItem>
                    <SelectItem value="FedEx">FedEx</SelectItem>
                    <SelectItem value="DTDC">DTDC</SelectItem>
                    <SelectItem value="Others">Others</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Vendor Field (when "Others" is selected) */}
              {formData.courierVendor === "Others" && (
                <div>
                  <Label htmlFor="customVendor">Custom Vendor Name *</Label>
                  <Input
                    id="customVendor"
                    value={formData.customVendor || ""}
                    onChange={(e) => setFormData({ ...formData, customVendor: e.target.value })}
                    placeholder="Enter vendor name"
                    required
                    data-testid="input-custom-courier-vendor"
                  />
                </div>
              )}

              {/* Custom Department Field (when "Other" is selected) - Sixth Field */}
              {formData.departmentId === undefined && (
                <div>
                  <Label htmlFor="customDepartment">Custom Department Name *</Label>
                  <Input
                    id="customDepartment"
                    value={formData.customDepartment || ""}
                    onChange={(e) => setFormData({ ...formData, customDepartment: e.target.value })}
                    placeholder="Enter department name"
                    required
                    data-testid="input-custom-department"
                  />
                </div>
              )}

              {/* Receiver Name - Seventh Field */}
              <div>
                <Label htmlFor="receiverName">Receiver Name</Label>
                <Input
                  id="receiverName"
                  value={formData.receiverName || ""}
                  onChange={(e) => setFormData({ ...formData, receiverName: e.target.value })}
                  placeholder="Name of person who received"
                  data-testid="input-receiver-name"
                />
              </div>

              {/* Email ID - Eighth Field */}
              <div>
                <Label htmlFor="emailId">Email ID</Label>
                <Input
                  id="emailId"
                  type="email"
                  value={formData.emailId || ""}
                  onChange={(e) => setFormData({ ...formData, emailId: e.target.value, sendEmailNotification: e.target.value ? true : false })}
                  placeholder="email@example.com"
                  data-testid="input-email-id"
                />
              </div>

              {/* Email Notification Checkbox */}
              {formData.emailId && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sendNotification"
                    checked={formData.sendEmailNotification || false}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, sendEmailNotification: !!checked })
                    }
                    data-testid="checkbox-send-notification"
                  />
                  <Label htmlFor="sendNotification" className="text-sm">
                    Send email notification to this address
                  </Label>
                </div>
              )}

              {/* Remarks - Ninth Field */}
              <div>
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea
                  id="remarks"
                  value={formData.remarks || ""}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Optional remarks..."
                  data-testid="textarea-remarks"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending}
                data-testid="button-submit"
              >
                {createMutation.isPending ? "Adding..." : "Add Received Courier"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Courier Details Dialog */}
      <Dialog open={!!viewingCourier} onOpenChange={() => setViewingCourier(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Received Courier Details</DialogTitle>
          </DialogHeader>
          
          {viewingCourier && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="font-semibold">POD Number</Label>
                  <p className="text-sm">{viewingCourier.podNumber || 'N/A'}</p>
                </div>
                
                <div>
                  <Label className="font-semibold">Status</Label>
                  <div className="flex flex-col gap-1 mt-1">
                    <span className={`inline-flex items-center w-fit px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      viewingCourier.status === 'received' 
                        ? 'bg-green-100 text-green-800' 
                        : viewingCourier.status === 'dispatched'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {viewingCourier.status === 'received' ? 'Confirmed Received' : 
                       viewingCourier.status === 'dispatched' ? 'Dispatched' : 'Pending'}
                    </span>
                    {viewingCourier.status === 'received' && (
                      <span className="text-xs text-green-600 font-medium">
                        ✅ Confirmed via Email Link
                      </span>
                    )}
                  </div>
                </div>
                
                <div>
                  <Label className="font-semibold">From Location</Label>
                  <p className="text-sm">{viewingCourier.fromLocation || 'N/A'}</p>
                </div>
                
                <div>
                  <Label className="font-semibold">Received Date</Label>
                  <p className="text-sm">
                    {viewingCourier.receivedDate ? new Date(viewingCourier.receivedDate + 'T00:00:00').toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                
                <div>
                  <Label className="font-semibold">Courier Vendor</Label>
                  <p className="text-sm">
                    {viewingCourier.courierVendor === 'Others' && viewingCourier.customVendor 
                      ? viewingCourier.customVendor 
                      : viewingCourier.courierVendor || 'N/A'}
                  </p>
                </div>
                
                <div>
                  <Label className="font-semibold">Receiver Name</Label>
                  <p className="text-sm">{viewingCourier.receiverName || 'N/A'}</p>
                </div>
                
                <div>
                  <Label className="font-semibold">Email ID</Label>
                  <p className="text-sm">{viewingCourier.emailId || 'N/A'}</p>
                </div>
                
                <div>
                  <Label className="font-semibold">Department</Label>
                  <p className="text-sm">{viewingCourier.departmentName || viewingCourier.customDepartment || 'N/A'}</p>
                </div>
              </div>
              
              {viewingCourier.remarks && (
                <div>
                  <Label className="font-semibold">Remarks</Label>
                  <p className="text-sm">{viewingCourier.remarks}</p>
                </div>
              )}
              
              {viewingCourier.status === 'received' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-800 mb-2">Email Confirmation Details</h4>
                  <div className="text-sm text-green-700">
                    <p>✅ Recipient confirmed receipt via email link</p>
                    <p>📧 Confirmation sent to: {viewingCourier.emailId}</p>
                    <p>📅 Last updated: {viewingCourier.updatedAt ? new Date(viewingCourier.updatedAt).toLocaleString() : 'N/A'}</p>
                  </div>
                </div>
              )}
              
              {viewingCourier.status === 'dispatched' && viewingCourier.emailId && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-2">Dispatch Details</h4>
                  <div className="text-sm text-blue-700">
                    <p>📤 Courier has been dispatched</p>
                    <p>📧 Notification sent to: {viewingCourier.emailId}</p>
                    <p>⏳ Awaiting email confirmation of receipt</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
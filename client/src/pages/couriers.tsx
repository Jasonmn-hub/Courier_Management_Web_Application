import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import CourierTable from "@/components/couriers/courier-table";
import CourierForm from "@/components/couriers/courier-form";
import PrintAuthorityForm from "@/components/print-authority/print-authority-form";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus } from "lucide-react";

export default function Couriers() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [showCourierForm, setShowCourierForm] = useState(false);
  const [editingCourier, setEditingCourier] = useState(null);

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

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const handleEdit = (courier: any) => {
    setEditingCourier(courier);
    setShowCourierForm(true);
  };

  const handleCloseForm = () => {
    setShowCourierForm(false);
    setEditingCourier(null);
  };

  const handleSuccess = () => {
    setShowCourierForm(false);
    setEditingCourier(null);
    toast({
      title: "Success",
      description: editingCourier ? "Courier updated successfully" : "Courier created successfully",
    });
  };

  return (
    <main className="flex-1 relative overflow-y-auto focus:outline-none">
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          {/* Page Header */}
          <div className="md:flex md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold leading-7 text-slate-900 sm:text-3xl sm:truncate">
                Sent Couriers
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Manage all courier shipments and track their status
              </p>
            </div>
            <div className="mt-4 flex md:mt-0 md:ml-4">
              <Button 
                onClick={() => setShowCourierForm(true)}
                data-testid="button-add-courier"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Courier
              </Button>
            </div>
          </div>

          {/* Tabs for different courier statuses */}
          <div className="mt-8">
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="flex w-full">
                <TabsTrigger value="all" data-testid="tab-all-couriers" className="flex-1">All Couriers</TabsTrigger>
                <TabsTrigger value="on_the_way" data-testid="tab-on-the-way" className="flex-1">On The Way</TabsTrigger>
                <TabsTrigger value="received" data-testid="tab-received" className="flex-1">Received</TabsTrigger>
                <TabsTrigger value="deleted" data-testid="tab-deleted" className="flex-1">Deleted</TabsTrigger>
              </TabsList>
              
              <TabsContent value="all" className="mt-6 max-h-96 overflow-y-auto">
                <CourierTable onEdit={handleEdit} />
              </TabsContent>
              
              <TabsContent value="on_the_way" className="mt-6 max-h-96 overflow-y-auto">
                <CourierTable status="on_the_way" onEdit={handleEdit} />
              </TabsContent>
              
              <TabsContent value="received" className="mt-6 max-h-96 overflow-y-auto">
                <CourierTable status="received" onEdit={handleEdit} />
              </TabsContent>
              
              <TabsContent value="deleted" className="mt-6 max-h-96 overflow-y-auto">
                <CourierTable status="deleted" onEdit={handleEdit} showRestore />
              </TabsContent>
              
            </Tabs>
          </div>
        </div>
      </div>

      {/* Add/Edit Courier Modal */}
      {showCourierForm && (
        <CourierForm
          courier={editingCourier}
          onClose={handleCloseForm}
          onSuccess={handleSuccess}
        />
      )}
    </main>
  );
}

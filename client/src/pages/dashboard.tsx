import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import StatsCards from "@/components/dashboard/stats-cards";
import Charts from "@/components/dashboard/charts";
import CourierTable from "@/components/couriers/courier-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import CourierForm from "@/components/couriers/courier-form";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [showCourierForm, setShowCourierForm] = useState(false);

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

  return (
    <main className="flex-1 relative overflow-y-auto focus:outline-none">
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          {/* Page Header */}
          <div className="md:flex md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold leading-7 text-slate-900 sm:text-3xl sm:truncate">
                Dashboard
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Overview of courier activities and department performance
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

          {/* Stats Cards */}
          <div className="mt-8">
            <StatsCards />
          </div>

          {/* Charts Section */}
          <div className="mt-8">
            <Charts />
          </div>

          {/* Recent Couriers Table */}
          <div className="mt-8">
            <CourierTable title="Recent Couriers" limit={5} />
          </div>
          
          {/* Received Couriers Table */}
          <div className="mt-8">
            <CourierTable 
              title="Received Couriers" 
              status="received"
              limit={5} 
            />
          </div>
        </div>
      </div>

      {/* Add Courier Modal */}
      {showCourierForm && (
        <CourierForm
          onClose={() => setShowCourierForm(false)}
          onSuccess={() => {
            setShowCourierForm(false);
            toast({
              title: "Success",
              description: "Courier created successfully",
            });
          }}
        />
      )}
    </main>
  );
}

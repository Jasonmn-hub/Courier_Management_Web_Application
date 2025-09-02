import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/landing";
import ResetPassword from "@/pages/reset-password";
import Dashboard from "@/pages/dashboard";
import Couriers from "@/pages/couriers";
import ReceivedCouriers from "@/pages/received-couriers";
import AuthorityLetter from "@/pages/authority-letter";
import AuthorityLetterNew from "@/pages/authority-letter-new";
import Users from "@/pages/users";
import UserPolicies from "@/pages/user-policies";
import Departments from "@/pages/departments";
import Branches from "@/pages/branches";
import Vendors from "@/pages/vendors";
import Settings from "@/pages/settings";
import AppLayout from "@/components/layout/app-layout";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <>
          <Route path="/" component={Landing} />
          <Route path="/login" component={Landing} />
          <Route path="/reset-password" component={ResetPassword} />
        </>
      ) : (
        <AppLayout>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/couriers" component={Couriers} />
            <Route path="/received-couriers" component={ReceivedCouriers} />
            <Route path="/authority-letter" component={AuthorityLetter} />
            <Route path="/users" component={Users} />
            <Route path="/user-policies" component={UserPolicies} />
            <Route path="/departments" component={Departments} />
            <Route path="/branches" component={Branches} />
            <Route path="/vendors" component={Vendors} />
            <Route path="/custom-fields" component={Settings} />
            <Route path="/audit-logs" component={Settings} />
            <Route path="/settings" component={Settings} />
          </Switch>
        </AppLayout>
      )}
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import RewardsStore from "./pages/RewardsStore";
import SpinWheel from "./pages/SpinWheel";
import Profile from "./pages/Profile";
import Transactions from "./pages/Transactions";
import Invoices from "./pages/Invoices";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminCustomers from "./pages/admin/AdminCustomers";
import AdminInvoices from "./pages/admin/AdminInvoices";
import AdminRewards from "./pages/admin/AdminRewards";
import AdminCampaigns from "./pages/admin/AdminCampaigns";
import AdminFraud from "./pages/admin/AdminFraud";
import CustomerLayout from "./components/CustomerLayout";
import Notifications from "./pages/Notifications";
import Referral from "./pages/Referral";
import AdminSettings from "./pages/admin/AdminSettings";
import InstallPrompt from "./components/InstallPrompt";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/rewards" component={RewardsStore} />
      <Route path="/spin" component={SpinWheel} />
      <Route path="/profile" component={Profile} />
      <Route path="/transactions" component={Transactions} />
      <Route path="/invoices" component={Invoices} />
      <Route path="/notifications" component={Notifications} />
      <Route path="/referral" component={Referral} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/customers" component={AdminCustomers} />
      <Route path="/admin/invoices" component={AdminInvoices} />
      <Route path="/admin/rewards" component={AdminRewards} />
      <Route path="/admin/campaigns" component={AdminCampaigns} />
      <Route path="/admin/fraud" component={AdminFraud} />
      <Route path="/admin/settings" component={AdminSettings} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
          <InstallPrompt />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

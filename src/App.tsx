import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { FiscalYearProvider } from "@/contexts/FiscalYearContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import TeamView from "./pages/TeamView";
import Admin from "./pages/Admin";
import DataInputs from "./pages/DataInputs";
import PlanBuilder from "./pages/PlanBuilder";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <FiscalYearProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<ProtectedRoute permissionKey="page:dashboard"><Dashboard /></ProtectedRoute>} />
            <Route
              path="/team"
              element={
                <ProtectedRoute permissionKey="page:team_view">
                  <TeamView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <Admin />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/plan/:planId"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <PlanBuilder />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute permissionKey="page:reports">
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route path="/data-inputs" element={<ProtectedRoute permissionKey="page:data_inputs"><DataInputs /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </FiscalYearProvider>
  </QueryClientProvider>
);

export default App;
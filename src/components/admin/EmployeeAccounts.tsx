import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  UserPlus, 
  Users, 
  CheckCircle, 
  Clock, 
  Loader2, 
  Search, 
  MoreHorizontal,
  Pencil,
  UserX,
  UserCheck,
  Plus
} from "lucide-react";
import { EmployeeFormDialog, EmployeeFormData } from "./EmployeeFormDialog";

interface Employee {
  id: string;
  employee_id: string;
  email: string;
  full_name: string;
  designation: string | null;
  country: string | null;
  city: string | null;
  date_of_hire: string | null;
  group_name: string | null;
  business_unit: string | null;
  function_area: string | null;
  sales_function: string | null;
  local_currency: string;
  manager_employee_id: string | null;
  auth_user_id: string | null;
  is_active: boolean;
}

export function EmployeeAccounts() {
  const [searchQuery, setSearchQuery] = useState("");
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [isCreatingAll, setIsCreatingAll] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deactivatingEmployee, setDeactivatingEmployee] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState("active");
  const queryClient = useQueryClient();

  // Fetch all employees (both active and inactive)
  const { data: allEmployees, isLoading } = useQuery({
    queryKey: ['employees-accounts-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('full_name');
      
      if (error) throw error;
      return data as Employee[];
    }
  });

  const activeEmployees = allEmployees?.filter(e => e.is_active) || [];
  const inactiveEmployees = allEmployees?.filter(e => !e.is_active) || [];
  const employees = activeTab === "active" ? activeEmployees : inactiveEmployees;

  // Create single account mutation
  const createAccountMutation = useMutation({
    mutationFn: async (employee: Employee) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('create-employee-account', {
        body: {
          employee_id: employee.employee_id,
          email: employee.email,
          full_name: employee.full_name
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to create account');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      return response.data;
    },
    onSuccess: (data, employee) => {
      toast.success(`Account created for ${employee.full_name}`, {
        description: `Temp password: Welcome@123`
      });
      queryClient.invalidateQueries({ queryKey: ['employees-accounts-all'] });
    },
    onError: (error: Error, employee) => {
      toast.error(`Failed to create account for ${employee.full_name}`, {
        description: error.message
      });
    }
  });

  // Create all accounts mutation
  const createAllAccountsMutation = useMutation({
    mutationFn: async (employeesWithoutAccounts: Employee[]) => {
      const results = [];
      for (const employee of employeesWithoutAccounts) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error('Not authenticated');

          const response = await supabase.functions.invoke('create-employee-account', {
            body: {
              employee_id: employee.employee_id,
              email: employee.email,
              full_name: employee.full_name
            }
          });

          if (response.error || response.data?.error) {
            results.push({ employee, success: false, error: response.error?.message || response.data?.error });
          } else {
            results.push({ employee, success: true });
          }
        } catch (err) {
          results.push({ employee, success: false, error: (err as Error).message });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      if (successCount > 0) {
        toast.success(`Created ${successCount} accounts`, {
          description: `Temp password for all: Welcome@123`
        });
      }
      if (failCount > 0) {
        toast.error(`Failed to create ${failCount} accounts`);
      }
      
      queryClient.invalidateQueries({ queryKey: ['employees-accounts-all'] });
    }
  });

  // Add employee mutation
  const addEmployeeMutation = useMutation({
    mutationFn: async (data: EmployeeFormData) => {
      const { error } = await supabase
        .from('employees')
        .insert({
          employee_id: data.employee_id,
          full_name: data.full_name,
          email: data.email,
          designation: data.designation || null,
          country: data.country || null,
          city: data.city || null,
          date_of_hire: data.date_of_hire || null,
          group_name: data.group_name || null,
          business_unit: data.business_unit || null,
          function_area: data.function_area || null,
          sales_function: data.sales_function || null,
          local_currency: data.local_currency || 'USD',
          manager_employee_id: data.manager_employee_id || null,
          is_active: true,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Employee added successfully");
      setShowAddDialog(false);
      queryClient.invalidateQueries({ queryKey: ['employees-accounts-all'] });
    },
    onError: (error: Error) => {
      toast.error("Failed to add employee", { description: error.message });
    }
  });

  // Update employee mutation
  const updateEmployeeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EmployeeFormData }) => {
      const { error } = await supabase
        .from('employees')
        .update({
          full_name: data.full_name,
          email: data.email,
          designation: data.designation || null,
          country: data.country || null,
          city: data.city || null,
          date_of_hire: data.date_of_hire || null,
          group_name: data.group_name || null,
          business_unit: data.business_unit || null,
          function_area: data.function_area || null,
          sales_function: data.sales_function || null,
          local_currency: data.local_currency || 'USD',
          manager_employee_id: data.manager_employee_id || null,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Employee updated successfully");
      setEditingEmployee(null);
      queryClient.invalidateQueries({ queryKey: ['employees-accounts-all'] });
    },
    onError: (error: Error) => {
      toast.error("Failed to update employee", { description: error.message });
    }
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('employees')
        .update({ is_active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(variables.is_active ? "Employee reactivated" : "Employee deactivated");
      setDeactivatingEmployee(null);
      queryClient.invalidateQueries({ queryKey: ['employees-accounts-all'] });
    },
    onError: (error: Error) => {
      toast.error("Failed to update employee status", { description: error.message });
    }
  });

  const handleCreateAccount = async (employee: Employee) => {
    setCreatingId(employee.id);
    await createAccountMutation.mutateAsync(employee);
    setCreatingId(null);
  };

  const handleCreateAllAccounts = async () => {
    const employeesWithoutAccounts = activeEmployees?.filter(e => !e.auth_user_id) || [];
    if (employeesWithoutAccounts.length === 0) {
      toast.info("All employees already have accounts");
      return;
    }
    
    setIsCreatingAll(true);
    await createAllAccountsMutation.mutateAsync(employeesWithoutAccounts);
    setIsCreatingAll(false);
  };

  const handleAddEmployee = async (data: EmployeeFormData) => {
    await addEmployeeMutation.mutateAsync(data);
  };

  const handleUpdateEmployee = async (data: EmployeeFormData) => {
    if (!editingEmployee) return;
    await updateEmployeeMutation.mutateAsync({ id: editingEmployee.id, data });
  };

  const handleDeactivate = async () => {
    if (!deactivatingEmployee) return;
    await toggleActiveMutation.mutateAsync({ 
      id: deactivatingEmployee.id, 
      is_active: !deactivatingEmployee.is_active 
    });
  };

  // Filter employees based on search
  const filteredEmployees = employees?.filter(emp => 
    emp.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.employee_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (emp.sales_function?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  // Stats
  const totalActive = activeEmployees?.length || 0;
  const totalInactive = inactiveEmployees?.length || 0;
  const withAccounts = activeEmployees?.filter(e => e.auth_user_id).length || 0;
  const withoutAccounts = totalActive - withAccounts;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Employees</p>
                <p className="text-2xl font-semibold text-foreground">{totalActive}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-success/10 text-success">
                <CheckCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">With Accounts</p>
                <p className="text-2xl font-semibold text-foreground">{withAccounts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-warning/10 text-warning">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Accounts</p>
                <p className="text-2xl font-semibold text-foreground">{withoutAccounts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <UserX className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Inactive</p>
                <p className="text-2xl font-semibold text-foreground">{totalInactive}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Employee Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Employee Management</CardTitle>
              <CardDescription>Add, edit, and manage employee records and authentication accounts</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                Add Employee
              </Button>
              <Button 
                variant="accent" 
                onClick={handleCreateAllAccounts}
                disabled={isCreatingAll || withoutAccounts === 0}
              >
                {isCreatingAll ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-1.5" />
                    Create All Accounts ({withoutAccounts})
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Tabs for Active/Inactive */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
            <TabsList>
              <TabsTrigger value="active">Active ({totalActive})</TabsTrigger>
              <TabsTrigger value="inactive">Inactive ({totalInactive})</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, employee ID, or sales function..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Sales Function</TableHead>
                    <TableHead>Account Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees?.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-mono text-sm">{employee.employee_id}</TableCell>
                      <TableCell className="font-medium">{employee.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{employee.email}</TableCell>
                      <TableCell>
                        {employee.sales_function ? (
                          <Badge variant="outline">{employee.sales_function}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {employee.auth_user_id ? (
                          <Badge className="bg-success/10 text-success hover:bg-success/20">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-warning/10 text-warning hover:bg-warning/20">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditingEmployee(employee)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit Details
                            </DropdownMenuItem>
                            {activeTab === "active" && !employee.auth_user_id && (
                              <DropdownMenuItem 
                                onClick={() => handleCreateAccount(employee)}
                                disabled={creatingId === employee.id}
                              >
                                <UserPlus className="h-4 w-4 mr-2" />
                                {creatingId === employee.id ? "Creating..." : "Create Account"}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => setDeactivatingEmployee(employee)}
                              className={employee.is_active ? "text-destructive" : "text-success"}
                            >
                              {employee.is_active ? (
                                <>
                                  <UserX className="h-4 w-4 mr-2" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <UserCheck className="h-4 w-4 mr-2" />
                                  Reactivate
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredEmployees?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No employees found matching your search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Help text */}
          <p className="text-sm text-muted-foreground mt-4">
            <strong>Default password:</strong> Welcome@123 — Share this with employees offline. 
            They should change it after first login.
          </p>
        </CardContent>
      </Card>

      {/* Add Employee Dialog */}
      <EmployeeFormDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSubmit={handleAddEmployee}
        isSubmitting={addEmployeeMutation.isPending}
      />

      {/* Edit Employee Dialog */}
      <EmployeeFormDialog
        open={!!editingEmployee}
        onOpenChange={(open) => !open && setEditingEmployee(null)}
        employee={editingEmployee}
        onSubmit={handleUpdateEmployee}
        isSubmitting={updateEmployeeMutation.isPending}
      />

      {/* Deactivate Confirmation Dialog */}
      <AlertDialog open={!!deactivatingEmployee} onOpenChange={(open) => !open && setDeactivatingEmployee(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deactivatingEmployee?.is_active ? "Deactivate Employee" : "Reactivate Employee"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deactivatingEmployee?.is_active 
                ? `Are you sure you want to deactivate ${deactivatingEmployee?.full_name}? They will no longer appear in active employee lists and won't be able to access the system.`
                : `Are you sure you want to reactivate ${deactivatingEmployee?.full_name}? They will be restored to the active employee list.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              className={deactivatingEmployee?.is_active ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {toggleActiveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : deactivatingEmployee?.is_active ? (
                "Deactivate"
              ) : (
                "Reactivate"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

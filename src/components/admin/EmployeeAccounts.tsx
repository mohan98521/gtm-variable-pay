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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserPlus, Users, CheckCircle, Clock, Loader2, Search, RefreshCw } from "lucide-react";

interface Employee {
  id: string;
  employee_id: string;
  email: string;
  full_name: string;
  designation: string | null;
  auth_user_id: string | null;
  is_active: boolean;
}

export function EmployeeAccounts() {
  const [searchQuery, setSearchQuery] = useState("");
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [isCreatingAll, setIsCreatingAll] = useState(false);
  const queryClient = useQueryClient();

  // Fetch all employees
  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, employee_id, email, full_name, designation, auth_user_id, is_active')
        .eq('is_active', true)
        .order('full_name');
      
      if (error) throw error;
      return data as Employee[];
    }
  });

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
      queryClient.invalidateQueries({ queryKey: ['employees-accounts'] });
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
      
      queryClient.invalidateQueries({ queryKey: ['employees-accounts'] });
    }
  });

  const handleCreateAccount = async (employee: Employee) => {
    setCreatingId(employee.id);
    await createAccountMutation.mutateAsync(employee);
    setCreatingId(null);
  };

  const handleCreateAllAccounts = async () => {
    const employeesWithoutAccounts = employees?.filter(e => !e.auth_user_id) || [];
    if (employeesWithoutAccounts.length === 0) {
      toast.info("All employees already have accounts");
      return;
    }
    
    setIsCreatingAll(true);
    await createAllAccountsMutation.mutateAsync(employeesWithoutAccounts);
    setIsCreatingAll(false);
  };

  // Filter employees based on search
  const filteredEmployees = employees?.filter(emp => 
    emp.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.employee_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Stats
  const totalEmployees = employees?.length || 0;
  const withAccounts = employees?.filter(e => e.auth_user_id).length || 0;
  const withoutAccounts = totalEmployees - withAccounts;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Employees</p>
                <p className="text-2xl font-semibold text-foreground">{totalEmployees}</p>
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
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-semibold text-foreground">{withoutAccounts}</p>
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
              <CardTitle className="text-lg">Employee Accounts</CardTitle>
              <CardDescription>Manage authentication accounts for employees</CardDescription>
            </div>
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
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or employee ID..."
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
                    <TableHead>Designation</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees?.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-mono text-sm">{employee.employee_id}</TableCell>
                      <TableCell className="font-medium">{employee.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{employee.email}</TableCell>
                      <TableCell className="text-muted-foreground">{employee.designation || '-'}</TableCell>
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
                        {employee.auth_user_id ? (
                          <Button variant="ghost" size="sm" disabled>
                            Account Exists
                          </Button>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleCreateAccount(employee)}
                            disabled={creatingId === employee.id}
                          >
                            {creatingId === employee.id ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                                Creating...
                              </>
                            ) : (
                              <>
                                <UserPlus className="h-3 w-3 mr-1.5" />
                                Create Account
                              </>
                            )}
                          </Button>
                        )}
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
    </div>
  );
}

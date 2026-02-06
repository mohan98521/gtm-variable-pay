import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PARTICIPANT_ROLES } from "@/hooks/useDeals";
import { Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
}

interface Participant {
  employee_id: string;
  participant_role: string;
  split_percent: number;
}

interface DealParticipantsEditorProps {
  participants: Participant[];
  employees: Employee[];
  onChange: (participants: Participant[]) => void;
}

export function DealParticipantsEditor({
  participants,
  employees,
  onChange,
}: DealParticipantsEditorProps) {
  const addParticipant = () => {
    onChange([
      ...participants,
      { employee_id: "", participant_role: "sales_rep", split_percent: 100 },
    ]);
  };

  const updateParticipant = (
    index: number,
    field: keyof Participant,
    value: string | number
  ) => {
    const updated = [...participants];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeParticipant = (index: number) => {
    onChange(participants.filter((_, i) => i !== index));
  };

  const employeeOptions = useMemo(() => [
    { value: "_none", label: "Select employee" },
    ...employees.filter(emp => emp.employee_id).map((employee) => ({
      value: employee.employee_id,
      label: `${employee.full_name} (${employee.employee_id})`,
    })),
  ], [employees]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium">Additional Participants (with Splits)</h4>
          <p className="text-xs text-muted-foreground">
            Add participants with custom split percentages for commission calculations
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addParticipant}>
          <Plus className="h-4 w-4 mr-1" />
          Add Participant
        </Button>
      </div>

      {participants.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center border rounded-md">
          No additional participants. Use the fields above for standard assignments.
        </p>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead className="w-24">Split %</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.map((participant, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Select
                      value={participant.participant_role}
                      onValueChange={(value) =>
                        updateParticipant(index, "participant_role", value)
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PARTICIPANT_ROLES.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <SearchableSelect
                      value={participant.employee_id || "_none"}
                      onValueChange={(value) =>
                        updateParticipant(index, "employee_id", value === "_none" ? "" : value)
                      }
                      options={employeeOptions}
                      placeholder="Select employee"
                      searchPlaceholder="Search employees..."
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={participant.split_percent}
                      onChange={(e) =>
                        updateParticipant(
                          index,
                          "split_percent",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="h-9 w-20"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeParticipant(index)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {participants.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Total Split: {participants.reduce((sum, p) => sum + p.split_percent, 0)}%
        </p>
      )}
    </div>
  );
}

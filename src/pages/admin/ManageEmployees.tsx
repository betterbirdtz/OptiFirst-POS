import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Plus, Edit, Shield, User, Smartphone, Lock, AlertCircle, RefreshCw } from "lucide-react";
import { appsScriptClient } from "../../api/appsScriptClient";
import type { Employee, UserSession } from "../../types";
import Modal from "../../components/common/Modal";
import { getSessionUser } from "../../utils/session";

export const ManageEmployees: React.FC = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);

  // Modal control
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState<"Admin" | "Employee">("Employee");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");

  const [user] = useState<UserSession | null>(() => getSessionUser());

  const loadEmployees = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await appsScriptClient.getEmployees();
      if (response.success && response.employees) {
        setEmployees(response.employees);
      } else {
        setError("Failed to fetch employees.");
      }
    } catch (e) {
      console.error(e);
      setError("Network error loading employee registry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== "Admin") {
      navigate("/login");
      return;
    }
    loadEmployees();
  }, [user, navigate]);

  const openAddModal = () => {
    setEditingEmployee(null);
    setName("");
    setPhone("");
    setPin("");
    setRole("Employee");
    setStatus("Active");
    setIsModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setName(emp.Name);
    setPhone(emp.Phone);
    setPin(""); // Leave blank unless they want to change PIN
    setRole(emp.Role);
    setStatus(emp.Status);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitLoading(true);

    if (!name.trim() || !phone.trim()) {
      setError("Name and Phone are required.");
      setSubmitLoading(false);
      return;
    }

    try {
      if (editingEmployee) {
        // UPDATE
        const updatePayload: {
          employeeId: string;
          name: string;
          phone: string;
          role: "Admin" | "Employee";
          status: "Active" | "Inactive";
          pin?: string;
        } = {
          employeeId: editingEmployee.EmployeeID,
          name: name.trim(),
          phone: phone.trim(),
          role,
          status
        };
        if (pin.trim()) {
          updatePayload.pin = pin.trim();
        }
        const response = await appsScriptClient.updateEmployee(updatePayload);
        if (response.success) {
          setIsModalOpen(false);
          loadEmployees();
        } else {
          setError(response.error || "Failed to update employee details.");
        }
      } else {
        // CREATE
        if (!pin.trim()) {
          setError("A secure PIN is required to create a new account.");
          setSubmitLoading(false);
          return;
        }
        const createPayload = {
          name: name.trim(),
          phone: phone.trim(),
          pin: pin.trim(),
          role,
          status
        };
        const response = await appsScriptClient.createEmployee(createPayload);
        if (response.success) {
          setIsModalOpen(false);
          loadEmployees();
        } else {
          setError(response.error || "Failed to create new employee account.");
        }
      }
    } catch (err) {
      console.error(err);
      setError("Network connection error. Try again.");
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center space-x-2">
            <Users className="h-5 w-5 text-primary" />
            <span>Manage Employees</span>
          </h1>
          <p className="text-xs text-muted-foreground">Register staff members and configure access permissions.</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadEmployees}
            className="p-2 border border-border rounded-lg hover:bg-secondary text-muted-foreground"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          
          <button
            onClick={openAddModal}
            className="flex items-center space-x-1.5 py-2 px-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 text-xs transition-all shadow-md shadow-primary/20"
          >
            <Plus className="h-4 w-4" />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {error && !isModalOpen && (
        <div className="flex items-center space-x-2 rounded-xl bg-destructive/10 p-3.5 text-sm text-destructive border border-destructive/20">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Employees Grid List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 border-4 border-t-transparent border-primary rounded-full animate-spin"></div>
        </div>
      ) : employees.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-2xl text-muted-foreground">
          <Users className="h-12 w-12 mx-auto opacity-20 mb-3" />
          <p className="font-medium text-sm">No employees registered yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((emp) => (
            <div key={emp.EmployeeID} className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground font-semibold">ID: {emp.EmployeeID}</span>
                  <h3 className="text-base font-bold text-foreground">{emp.Name}</h3>
                  <p className="text-xs text-muted-foreground flex items-center space-x-1">
                    <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{emp.Phone}</span>
                  </p>
                </div>
                <button
                  onClick={() => openEditModal(emp)}
                  className="p-1.5 border border-border rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                >
                  <Edit className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-border/50">
                <div className="flex items-center space-x-1.5">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-foreground/80">{emp.Role}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                  emp.Status === "Active" 
                    ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/20 dark:text-green-400" 
                    : "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/20 dark:text-red-400"
                }`}>
                  {emp.Status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingEmployee ? "Edit Employee Profile" : "Register New Employee"}
      >
        <form onSubmit={handleFormSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="flex items-center space-x-2 rounded-xl bg-destructive/10 p-3 text-xs text-destructive border border-destructive/20">
              <AlertCircle className="h-4.5 w-4.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full pl-9 pr-3 py-2 border border-input rounded-xl bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">Phone Number</label>
            <div className="relative">
              <Smartphone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1234567890"
                className="w-full pl-9 pr-3 py-2 border border-input rounded-xl bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">
              {editingEmployee ? "New PIN (Leave blank to keep current)" : "Secure PIN"}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="4-digit secure code"
                maxLength={6}
                className="w-full pl-9 pr-3 py-2 border border-input rounded-xl bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-1">System Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "Admin" | "Employee")}
                className="w-full px-3 py-2 border border-input rounded-xl bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="Employee">Employee</option>
                <option value="Admin">Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-1">Account Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "Active" | "Inactive")}
                className="w-full px-3 py-2 border border-input rounded-xl bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-border rounded-xl text-xs font-semibold hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitLoading}
              className="flex items-center space-x-1 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 text-xs disabled:opacity-50"
            >
              {submitLoading ? (
                <div className="h-3.5 w-3.5 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
              ) : (
                <span>Save</span>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
export default ManageEmployees;

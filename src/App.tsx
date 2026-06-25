import React from "react";
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./components/common/Navbar";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { getSessionUser } from "./utils/session";
import Login from "./pages/Login";
import AdminDashboard from "./pages/admin/AdminDashboard";
import Collections from "./pages/admin/Collections";
import DailySales from "./pages/admin/DailySales";
import DailyStock from "./pages/admin/DailyStock";
import ManageEmployees from "./pages/admin/ManageEmployees";
import ManageProducts from "./pages/admin/ManageProducts";
import Reports from "./pages/admin/Reports";
import Shops from "./pages/admin/Shops";
import AdminMTN from "./pages/admin/AdminMTN";
import OpeningStockPage from "./pages/admin/OpeningStock";
import EmployeeData from "./pages/admin/EmployeeData";
import EmployeeDashboard from "./pages/employee/EmployeeDashboard";
import MyReports from "./pages/employee/MyReports";
import DailySalesEntry from "./pages/employee/DailySalesEntry";
import EodClosing from "./pages/employee/EodClosing";
import CollectionEntry from "./pages/employee/CollectionEntry";
import MaterialTransferNote from "./pages/employee/MaterialTransferNote";
import EditReport from "./pages/employee/EditReport";

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const user = getSessionUser();
  const isLoginPage = location.pathname === "/login";
  const isAdmin = user?.role === "Admin";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {!isLoginPage && <Navbar />}
      <main className={`${!isLoginPage && isAdmin ? "lg:pl-64" : ""} ${!isLoginPage ? "pb-24 lg:pb-0" : ""}`}>
        {children}
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <Router>
      <AppLayout>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Employee Routes */}
          <Route path="/employee/dashboard" element={<ProtectedRoute allowedRoles={["Employee"]}><EmployeeDashboard /></ProtectedRoute>} />
          <Route path="/employee/daily-sales" element={<ProtectedRoute allowedRoles={["Employee", "Admin"]}><DailySalesEntry /></ProtectedRoute>} />
          <Route path="/employee/closing" element={<ProtectedRoute allowedRoles={["Employee", "Admin"]}><EodClosing /></ProtectedRoute>} />
          <Route path="/employee/collection" element={<ProtectedRoute allowedRoles={["Employee", "Admin"]}><CollectionEntry /></ProtectedRoute>} />
          <Route path="/employee/mtn" element={<ProtectedRoute allowedRoles={["Employee", "Admin"]}><MaterialTransferNote /></ProtectedRoute>} />
          <Route path="/employee/my-reports" element={<ProtectedRoute allowedRoles={["Employee", "Admin"]}><MyReports /></ProtectedRoute>} />
          <Route path="/employee/edit-report" element={<ProtectedRoute allowedRoles={["Employee", "Admin"]}><EditReport /></ProtectedRoute>} />

          {/* Admin Routes */}
          <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={["Admin"]}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/shops" element={<ProtectedRoute allowedRoles={["Admin"]}><Shops /></ProtectedRoute>} />
          <Route path="/admin/employees" element={<ProtectedRoute allowedRoles={["Admin"]}><ManageEmployees /></ProtectedRoute>} />
          <Route path="/admin/products" element={<ProtectedRoute allowedRoles={["Admin"]}><ManageProducts /></ProtectedRoute>} />
          <Route path="/admin/opening-stock" element={<ProtectedRoute allowedRoles={["Admin"]}><OpeningStockPage /></ProtectedRoute>} />
          <Route path="/admin/mtn" element={<ProtectedRoute allowedRoles={["Admin"]}><AdminMTN /></ProtectedRoute>} />
          <Route path="/admin/reports" element={<ProtectedRoute allowedRoles={["Admin"]}><Reports /></ProtectedRoute>} />
          <Route path="/admin/daily-sales" element={<ProtectedRoute allowedRoles={["Admin"]}><DailySales /></ProtectedRoute>} />
          <Route path="/admin/daily-stock" element={<ProtectedRoute allowedRoles={["Admin"]}><DailyStock /></ProtectedRoute>} />
          <Route path="/admin/collections" element={<ProtectedRoute allowedRoles={["Admin"]}><Collections /></ProtectedRoute>} />
          <Route path="/admin/employee-data" element={<ProtectedRoute allowedRoles={["Admin"]}><EmployeeData /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AppLayout>
    </Router>
  );
};

export default App;

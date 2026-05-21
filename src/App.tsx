import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Navbar from "./components/common/Navbar";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import Login from "./pages/Login";

// Employee Pages
import EmployeeDashboard from "./pages/employee/EmployeeDashboard";
import TodayReport from "./pages/employee/TodayReport";
import MyReports from "./pages/employee/MyReports";

// Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import ManageEmployees from "./pages/admin/ManageEmployees";
import ManageProducts from "./pages/admin/ManageProducts";
import Reports from "./pages/admin/Reports";
import DailySales from "./pages/admin/DailySales";
import DailyStock from "./pages/admin/DailyStock";
import CreditSales from "./pages/admin/CreditSales";
import StockMismatch from "./pages/admin/StockMismatch";

// Layout wrapper that renders the navbar on protected pages
const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const isLoginPage = location.pathname === "/login";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {!isLoginPage && <Navbar />}
      <main className="flex-grow pb-28 lg:pb-16">
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
          {/* Public Login Route */}
          <Route path="/login" element={<Login />} />

          {/* Root Redirect based on session */}
          <Route 
            path="/" 
            element={<Navigate to="/login" replace />} 
          />

          {/* Employee Protected Routes */}
          <Route
            path="/employee/dashboard"
            element={
              <ProtectedRoute allowedRoles={["Employee"]}>
                <EmployeeDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/today-report"
            element={
              <ProtectedRoute allowedRoles={["Employee"]}>
                <TodayReport />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/my-reports"
            element={
              <ProtectedRoute allowedRoles={["Employee"]}>
                <MyReports />
              </ProtectedRoute>
            }
          />

          {/* Admin Protected Routes */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={["Admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <ProtectedRoute allowedRoles={["Admin"]}>
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/daily-sales"
            element={
              <ProtectedRoute allowedRoles={["Admin"]}>
                <DailySales />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/daily-stock"
            element={
              <ProtectedRoute allowedRoles={["Admin"]}>
                <DailyStock />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/credit-sales"
            element={
              <ProtectedRoute allowedRoles={["Admin"]}>
                <CreditSales />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/stock-mismatch"
            element={
              <ProtectedRoute allowedRoles={["Admin"]}>
                <StockMismatch />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/products"
            element={
              <ProtectedRoute allowedRoles={["Admin"]}>
                <ManageProducts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/employees"
            element={
              <ProtectedRoute allowedRoles={["Admin"]}>
                <ManageEmployees />
              </ProtectedRoute>
            }
          />

          {/* Catch-all Redirect */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AppLayout>
    </Router>
  );
};

export default App;

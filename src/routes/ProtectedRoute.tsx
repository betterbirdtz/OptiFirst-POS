import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import type { UserRole } from "../types";
import { getSessionUser } from "../utils/session";

interface ProtectedRouteProps {
  allowedRoles: UserRole[];
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const userSession = getSessionUser();

  if (!userSession) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(userSession.role)) {
    return <Navigate to={userSession.role === "Admin" ? "/admin/dashboard" : "/employee/dashboard"} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

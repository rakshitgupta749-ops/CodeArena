import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRole: "admin" | "user" | "faculty" | ("admin" | "user" | "faculty")[];
}

export function ProtectedRoute({ children, allowedRole }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const allowedRolesArray = Array.isArray(allowedRole) ? allowedRole : [allowedRole];

  if (!user || !allowedRolesArray.includes(user.role as any)) {
    return <Navigate to={user?.role === "admin" || user?.role === "faculty" ? "/admin" : "/problems"} replace />;
  }

  return <>{children}</>;
}

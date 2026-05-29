import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardCheck,
  ClipboardList,
  Home,
  LogOut,
  Menu,
  Package,
  ShoppingBag,
  Users,
  WalletCards,
  X
} from "lucide-react";
import { getSessionUser } from "../../utils/session";

type NavigationItem = {
  to: string;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
};

const adminLinks: NavigationItem[] = [
  { to: "/admin/dashboard", label: "Dashboard", shortLabel: "Home", icon: BarChart3 },
  { to: "/admin/shops", label: "Shops", shortLabel: "Shops", icon: Building2 },
  { to: "/admin/employees", label: "Employees", shortLabel: "Staff", icon: Users },
  { to: "/admin/products", label: "Products & Pricing", shortLabel: "Items", icon: Package },
  { to: "/admin/opening-stock", label: "Opening Stock", shortLabel: "Opening", icon: Boxes },
  { to: "/admin/mtn", label: "Stock Transfer", shortLabel: "MTN", icon: ClipboardCheck },
  { to: "/admin/reports", label: "Approvals", shortLabel: "Approve", icon: ClipboardCheck },
  { to: "/admin/daily-sales", label: "Sales & Credit", shortLabel: "Sales", icon: ShoppingBag },
  { to: "/admin/daily-stock", label: "Stock & Mismatch", shortLabel: "Stock", icon: Boxes },
  { to: "/admin/collections", label: "Collections", shortLabel: "Collect", icon: WalletCards },
  { to: "/admin/employee-data", label: "Employee Data", shortLabel: "Data", icon: ClipboardList }
];

const employeeLinks: NavigationItem[] = [
  { to: "/employee/dashboard", label: "Dashboard", shortLabel: "Home", icon: Home },
  { to: "/employee/daily-sales", label: "Daily Sales", shortLabel: "Sales", icon: ShoppingBag },
  { to: "/employee/closing", label: "EOD Closing", shortLabel: "Closing", icon: Boxes },
  { to: "/employee/my-reports", label: "My Reports", shortLabel: "History", icon: ClipboardList }
];

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = getSessionUser();

  if (!user) return null;

  const links = user.role === "Admin" ? adminLinks : employeeLinks;
  const bottomLinks = user.role === "Admin" ? adminLinks.slice(0, 4) : employeeLinks;
  const activePath = location.pathname;

  const logout = () => {
    localStorage.removeItem("session_user");
    navigate("/login");
  };

  const renderLink = (item: NavigationItem, compact = false) => {
    const Icon = item.icon;
    const active = activePath === item.to;
    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
          active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        } ${compact ? "min-h-14 flex-col justify-center gap-1 px-2 py-2 text-[11px]" : ""}`}
      >
        <Icon className={compact ? "h-4 w-4" : "h-4 w-4"} />
        <span>{compact ? item.shortLabel : item.label}</span>
      </Link>
    );
  };

  return (
    <>
      {user.role === "Admin" && (
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border bg-card lg:flex lg:flex-col">
          <Link to="/admin/dashboard" className="flex h-16 items-center gap-3 border-b border-border px-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-base font-black text-white">O</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-black">OptiFirst POS</p>
              <p className="text-[11px] font-semibold text-muted-foreground">Better Bird reporting</p>
            </div>
          </Link>

          <nav className="flex-1 space-y-1 overflow-y-auto p-3">{adminLinks.map((item) => renderLink(item))}</nav>

          <div className="border-t border-border p-3">
            <div className="mb-3 rounded-lg bg-secondary/60 p-3">
              <p className="truncate text-sm font-bold">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.role}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </aside>
      )}

      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur lg:hidden">
        <div className="flex min-h-14 items-center justify-between px-3">
          <Link to={user.role === "Admin" ? "/admin/dashboard" : "/employee/dashboard"} className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-black text-white">O</span>
            <div>
              <p className="text-sm font-black leading-tight">OptiFirst POS</p>
              <p className="text-[11px] text-muted-foreground">{user.shopName || user.role}</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            className="rounded-lg border border-border p-2 text-muted-foreground"
            aria-label="Open navigation"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-x-3 top-16 z-50 rounded-lg border border-border bg-card p-3 shadow-xl lg:hidden">
          <div className="grid grid-cols-2 gap-2">{links.map((item) => renderLink(item))}</div>
          <button
            type="button"
            onClick={logout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-10px_24px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
        <div className={`mx-auto grid max-w-md ${user.role === "Admin" ? "grid-cols-5" : "grid-cols-4"} gap-1`}>
          {bottomLinks.map((item) => renderLink(item, true))}
          {user.role === "Admin" && (
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Menu className="h-4 w-4" />
              <span>More</span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
};

export default Navbar;

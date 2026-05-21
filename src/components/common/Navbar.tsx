import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { 
  LogOut, 
  Menu, 
  X, 
  LayoutDashboard, 
  Users, 
  ShoppingBag, 
  FileText, 
  TrendingUp, 
  AlertTriangle,
  ClipboardList,
  FileCheck,
  CircleDollarSign
} from "lucide-react";
import { getSessionUser } from "../../utils/session";

type NavigationItem = {
  to: string;
  label: string;
  shortLabel?: string;
  icon: React.ComponentType<{ className?: string }>;
};

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  
  const user = getSessionUser();
  if (!user) return null;

  const handleLogout = () => {
    localStorage.removeItem("session_user");
    navigate("/login");
  };

  const adminLinks: NavigationItem[] = [
    { to: "/admin/dashboard", label: "Dashboard", shortLabel: "Home", icon: LayoutDashboard },
    { to: "/admin/reports", label: "Approvals", shortLabel: "Reports", icon: FileCheck },
    { to: "/admin/credit-sales", label: "Credit Sales", shortLabel: "Credit", icon: CircleDollarSign },
    { to: "/admin/stock-mismatch", label: "Stock Mismatch", shortLabel: "Mismatch", icon: AlertTriangle },
    { to: "/admin/daily-sales", label: "Sales Logs", shortLabel: "Sales", icon: TrendingUp },
    { to: "/admin/daily-stock", label: "Stock Logs", shortLabel: "Stock", icon: ClipboardList },
    { to: "/admin/products", label: "Products", shortLabel: "Products", icon: ShoppingBag },
    { to: "/admin/employees", label: "Employees", shortLabel: "Staff", icon: Users },
  ];

  const employeeLinks: NavigationItem[] = [
    { to: "/employee/dashboard", label: "Home", shortLabel: "Home", icon: LayoutDashboard },
    { to: "/employee/today-report", label: "New Daily Report", shortLabel: "Report", icon: FileText },
    { to: "/employee/my-reports", label: "My Submitted Reports", shortLabel: "History", icon: ClipboardList },
  ];

  const links = user.role === "Admin" ? adminLinks : employeeLinks;
  const mobilePrimaryLinks = user.role === "Admin"
    ? adminLinks.filter((link) =>
        ["/admin/dashboard", "/admin/reports", "/admin/daily-sales", "/admin/daily-stock"].includes(link.to)
      )
    : employeeLinks;

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <nav className="sticky top-0 z-40 w-full border-b border-border bg-card/95 shadow-sm backdrop-blur-md">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-16 items-center gap-4 py-2">
          <Link
            to={user.role === "Admin" ? "/admin/dashboard" : "/employee/dashboard"}
            className="flex shrink-0 items-center gap-2 rounded-2xl pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-lg font-black text-white shadow-lg shadow-primary/20">
                O
              </span>
              <span className="max-w-[180px] truncate text-base font-black tracking-tight text-foreground sm:text-lg">
                OptiFirst POS
              </span>
          </Link>

          {/* Desktop Links */}
          <div className="nav-scrollbar hidden min-w-0 flex-1 items-center gap-1.5 overflow-x-auto rounded-2xl bg-secondary/70 p-1 lg:flex">
            {links.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-card hover:text-foreground"
                  }`}
                  title={link.label}
                >
                  <Icon className="h-4 w-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>

          {/* User Info & Logout (Desktop) */}
          <div className="hidden shrink-0 items-center gap-3 lg:flex">
            <div className="flex flex-col text-right">
              <span className="max-w-[150px] truncate text-sm font-black text-foreground">{user.name}</span>
              <span className="text-xs font-semibold capitalize text-muted-foreground">{user.role}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center rounded-xl p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/30"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>

          {/* Mobile Hamburger Toggle */}
          <div className="ml-auto flex items-center lg:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="rounded-xl p-2 text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      </nav>

      {/* Mobile Drawer menu */}
      {isOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 top-16 z-40 bg-slate-950/20 backdrop-blur-[1px] lg:hidden"
            onClick={() => setIsOpen(false)}
            aria-label="Close navigation menu"
          />
          <div className="fixed inset-x-3 top-20 z-50 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-3xl border border-border bg-card p-3 shadow-2xl lg:hidden">
            <div className="border-b border-border px-2 pb-3">
              <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Quick Menu</p>
              <p className="mt-1 truncate text-sm font-bold text-foreground">{user.name}</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
            {links.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setIsOpen(false)}
                  className={`flex min-h-16 flex-col justify-center gap-1 rounded-2xl border px-3 py-3 text-sm font-black transition-colors ${
                    active
                      ? "border-primary/20 bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="leading-tight">{link.shortLabel || link.label}</span>
                </Link>
              );
            })}
            </div>
            
            <div className="mt-3 flex items-center justify-between rounded-2xl border border-border bg-background p-3">
              <div className="flex flex-col">
                <span className="text-sm font-semibold">{user.name}</span>
                <span className="text-xs text-muted-foreground capitalize">{user.role}</span>
              </div>
              <button
                onClick={() => {
                  setIsOpen(false);
                  handleLogout();
                }}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors text-sm font-medium"
                aria-label="Logout"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </>
      )}

      <div className={`fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur-md transition-opacity lg:hidden ${isOpen ? "pointer-events-none opacity-0" : "opacity-100"}`}>
        <div className={`mx-auto grid max-w-md ${user.role === "Admin" ? "grid-cols-5" : "grid-cols-3"} gap-1`}>
          {mobilePrimaryLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.to);
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-black transition-colors ${
                  active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{link.shortLabel || link.label}</span>
              </Link>
            );
          })}

          {user.role === "Admin" && (
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-black transition-colors ${
                isOpen ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
              aria-label="Open more admin navigation"
            >
              <Menu className="h-4 w-4" />
              <span>More</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
};
export default Navbar;

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, KeyRound, LogIn, Phone } from "lucide-react";
import { appsScriptClient, isMockMode } from "../api/appsScriptClient";

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const mockActive = isMockMode();

  useEffect(() => {
    const session = localStorage.getItem("session_user");
    if (!session) return;
    try {
      const user = JSON.parse(session);
      navigate(user.role === "Admin" ? "/admin/dashboard" : "/employee/dashboard", { replace: true });
    } catch {
      localStorage.removeItem("session_user");
    }
  }, [navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!phone.trim() || !pin.trim()) {
      setError("Enter both phone number and PIN.");
      return;
    }

    setLoading(true);
    try {
      const response = await appsScriptClient.login(phone.trim(), pin.trim());
      if (response.success && response.user) {
        localStorage.setItem("session_user", JSON.stringify(response.user));
        navigate(response.user.role === "Admin" ? "/admin/dashboard" : "/employee/dashboard", { replace: true });
      } else {
        setError(response.error || "Invalid phone or PIN.");
      }
    } catch (loginError) {
      console.error(loginError);
      setError("Login failed. Check the Apps Script URL and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-lg lg:grid-cols-[1fr_420px]">
        {/* Left column (Desktop only illustration) */}
        <div className="hidden bg-slate-900 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-xl font-black text-slate-900">O</div>
            <h1 className="mt-8 max-w-md text-3xl font-black leading-tight">OptiFirst TZ daily sales, stock, and collection reporting</h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
              Employees submit one daily report per shop. Admin reviews sales, deposits, EFD variance, credit sales, and stock mismatches from one dashboard.
            </p>
          </div>
          <p className="text-xs text-slate-400">Google Sheets database + Apps Script API</p>
        </div>

        {/* Right column (Login Form) */}
        <div className="p-6 sm:p-10 flex flex-col justify-center">
          <div className="mb-7">
            <div className="flex items-center gap-2 lg:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-base font-black text-white">O</div>
              <span className="text-base font-black tracking-tight text-foreground">OptiFirst TZ</span>
            </div>
            <h2 className="mt-5 text-2xl font-black tracking-tight">Sign in</h2>
            <p className="mt-1 text-sm text-muted-foreground">Use your phone number and PIN.</p>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="phone" className="mb-1.5 block text-sm font-semibold">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="w-full rounded-lg border border-input bg-background py-3 pl-10 pr-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring"
                  placeholder="+255700000000"
                />
              </div>
            </div>

            <div>
              <label htmlFor="pin" className="mb-1.5 block text-sm font-semibold">
                PIN
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="current-password"
                  value={pin}
                  onChange={(event) => setPin(event.target.value)}
                  className="w-full rounded-lg border border-input bg-background py-3 pl-10 pr-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring"
                  placeholder="4 digit PIN"
                  maxLength={8}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60 hover:bg-primary/95 transition-colors"
            >
              {loading ? <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <LogIn className="h-4 w-4" />}
              Sign In
            </button>
          </form>

          {mockActive && (
            <div className="mt-6 rounded-xl border border-border bg-secondary/35 p-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Quick Mock Accounts</p>
              <div className="mt-2.5 grid gap-2 text-xs sm:grid-cols-2">
                <button type="button" onClick={() => { setPhone("+255700000000"); setPin("1234"); }} className="rounded-lg border border-border/80 bg-card px-3 py-2.5 text-left font-semibold hover:border-primary/50 transition-colors shadow-sm">
                  <span className="block font-black text-foreground">Admin</span>
                  <span className="text-muted-foreground text-[10px] font-medium">+255700000000 / 1234</span>
                </button>
                <button type="button" onClick={() => { setPhone("+255700000101"); setPin("1111"); }} className="rounded-lg border border-border/80 bg-card px-3 py-2.5 text-left font-semibold hover:border-primary/50 transition-colors shadow-sm">
                  <span className="block font-black text-foreground">Employee</span>
                  <span className="text-muted-foreground text-[10px] font-medium">+255700000101 / 1111</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;

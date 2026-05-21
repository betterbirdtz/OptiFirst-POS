import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, Phone, AlertCircle, LogIn, Cpu } from "lucide-react";
import { appsScriptClient, isMockMode } from "../api/appsScriptClient";

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mockActive] = useState(isMockMode());

  useEffect(() => {
    // Check if session already exists
    const session = localStorage.getItem("session_user");
    if (session) {
      try {
        const user = JSON.parse(session);
        if (user.role === "Admin") {
          navigate("/admin/dashboard");
        } else {
          navigate("/employee/dashboard");
        }
      } catch {
        localStorage.removeItem("session_user");
      }
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!phone || !pin) {
      setError("Please enter both phone number and PIN");
      return;
    }

    setLoading(true);
    try {
      const response = await appsScriptClient.login(phone, pin);
      
      if (response.success && response.user) {
        localStorage.setItem("session_user", JSON.stringify(response.user));
        
        if (response.user.role === "Admin") {
          navigate("/admin/dashboard");
        } else {
          navigate("/employee/dashboard");
        }
      } else {
        setError(response.error || "Authentication failed. Invalid phone or PIN.");
      }
    } catch (err) {
      setError("Network error. Please try again later.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-secondary px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Dynamic Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-indigo-400 text-white font-black text-2xl shadow-xl shadow-primary/20 animate-bounce">
            O
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-foreground">
            OptiFirst POS
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Daily Sales and Stock reporting system
          </p>
        </div>

        <div className="bg-card border border-border/80 rounded-2xl p-8 shadow-xl">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="flex items-center space-x-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20 animate-shake">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="phone" className="block text-sm font-semibold text-foreground/80 mb-2">
                Phone Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                  <Phone className="h-5 w-5" />
                </div>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm placeholder-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                  placeholder="+1234567890"
                />
              </div>
            </div>

            <div>
              <label htmlFor="pin" className="block text-sm font-semibold text-foreground/80 mb-2">
                Secure PIN
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                  <KeyRound className="h-5 w-5" />
                </div>
                <input
                  id="pin"
                  name="pin"
                  type="password"
                  required
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm placeholder-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                  placeholder="PIN"
                  maxLength={6}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center space-x-2 py-3 px-4 border border-transparent rounded-xl text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20 hover:shadow-primary/30"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {mockActive && (
            <div className="mt-6 border-t border-border pt-4">
              <div className="flex items-center space-x-2 text-xs text-muted-foreground justify-center bg-secondary/50 py-2 rounded-lg border border-border/50">
                <Cpu className="h-4 w-4 text-primary" />
                <span><strong>Developer Notice:</strong> Mock Mode is active.</span>
              </div>
              <div className="mt-3 text-center space-y-1">
                <p className="text-[10px] text-muted-foreground">Quick login info (click to fill):</p>
                <div className="flex justify-center space-x-2">
                  <button 
                    onClick={() => { setPhone("+1234567890"); setPin("1234"); }}
                    className="text-[10px] text-primary hover:underline bg-primary/5 px-2 py-1 rounded"
                  >
                    Admin (+1234567890 / 1234)
                  </button>
                  <button 
                    onClick={() => { setPhone("+1234567891"); setPin("5678"); }}
                    className="text-[10px] text-primary hover:underline bg-primary/5 px-2 py-1 rounded"
                  >
                    Employee (+1234567891 / 5678)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default Login;

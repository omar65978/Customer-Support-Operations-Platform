  import { useState, type FormEvent } from "react";
  import { Link, useNavigate } from "react-router-dom";
  import { useAuth } from "../contexts/AuthContext";
  import { Spinner } from "../components/ui/Spinner";

  interface FormErrors {
    email?: string;
    password?: string;
    general?: string;
  }

  export function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errors, setErrors] = useState<FormErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    function validate(): boolean {
      const errs: FormErrors = {};
      if (!email.trim()) errs.email = "Email is required.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Enter a valid email address.";
      if (!password) errs.password = "Password is required.";
      setErrors(errs);
      return Object.keys(errs).length === 0;
    }

    async function handleSubmit(e: FormEvent) {
      e.preventDefault();
      if (!validate()) return;
      setIsSubmitting(true);
      setErrors({});
      try {
        await login({ email: email.trim(), password });
        navigate("/dashboard");
      } catch {
        setErrors({ general: "Invalid email or password. Please try again." });
      } finally {
        setIsSubmitting(false);
      }
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 shadow-lg">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-white">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93V18c0-.55.45-1 1-1s1 .45 1 1v1.93A8.012 8.012 0 014.07 13H6c.55 0 1 .45 1 1s-.45 1-1 1H4.07A8.012 8.012 0 0111 19.93zM12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z" fill="currentColor"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Support Portal</h1>
            <p className="mt-1 text-brand-200">Sign in to manage your support requests</p>
          </div>

          <div className="glass-card p-8">
            <form onSubmit={handleSubmit} noValidate id="login-form">
              {errors.general && (
                <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 animate-fade-in">
                  {errors.general}
                </div>
              )}

              <div className="mb-4">
                <label htmlFor="email" className="label">Email address</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={`input-field ${errors.email ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
                />
                {errors.email && <p className="error-text">{errors.email}</p>}
              </div>

              <div className="mb-6">
                <label htmlFor="password" className="label">Password</label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`input-field ${errors.password ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
                />
                {errors.password && <p className="error-text">{errors.password}</p>}
              </div>

              <button
                type="submit"
                id="login-submit"
                disabled={isSubmitting}
                className="btn-primary w-full py-3 text-base"
              >
                {isSubmitting ? <><Spinner size="sm" /> Signing in…</> : "Sign in"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600">
              Don't have an account?{" "}
              <Link to="/register" className="font-medium text-brand-600 hover:text-brand-700 transition-colors">
                Create one
              </Link>
            </p>
          </div>

          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-brand-200">
            <p className="font-medium mb-1 text-brand-100">Demo credentials</p>
            <p>alice@example.com · password123</p>
            <p>bob@example.com · password123</p>
          </div>
        </div>
      </div>
    );
  }

import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Spinner } from "../components/ui/Spinner";

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): boolean {
    const errs: FormErrors = {};
    if (!name.trim()) errs.name = "Full name is required.";
    else if (name.trim().length < 2) errs.name = "Name must be at least 2 characters.";
    if (!email.trim()) errs.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Enter a valid email address.";
    if (!password) errs.password = "Password is required.";
    else if (password.length < 8) errs.password = "Password must be at least 8 characters.";
    if (!confirmPassword) errs.confirmPassword = "Please confirm your password.";
    else if (password !== confirmPassword) errs.confirmPassword = "Passwords do not match.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    setErrors({});
    try {
      await register({ email: email.trim(), password, name: name.trim(), role: "customer" });
      navigate("/dashboard");
    } catch {
      setErrors({ general: "Registration failed. This email may already be in use." });
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
          <h1 className="text-2xl font-bold text-white">Create an Account</h1>
          <p className="mt-1 text-brand-200">Join the customer support portal</p>
        </div>

        <div className="glass-card p-8">
          <form onSubmit={handleSubmit} noValidate id="register-form">
            {errors.general && (
              <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 animate-fade-in">
                {errors.general}
              </div>
            )}

            <div className="mb-4">
              <label htmlFor="name" className="label">Full name</label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alice Johnson"
                className={`input-field ${errors.name ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
              />
              {errors.name && <p className="error-text">{errors.name}</p>}
            </div>

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

            <div className="mb-4">
              <label htmlFor="password" className="label">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className={`input-field ${errors.password ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
              />
              {errors.password && <p className="error-text">{errors.password}</p>}
            </div>

            <div className="mb-6">
              <label htmlFor="confirm-password" className="label">Confirm password</label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className={`input-field ${errors.confirmPassword ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
              />
              {errors.confirmPassword && <p className="error-text">{errors.confirmPassword}</p>}
            </div>

            <button
              type="submit"
              id="register-submit"
              disabled={isSubmitting}
              className="btn-primary w-full py-3 text-base"
            >
              {isSubmitting ? <><Spinner size="sm" /> Creating account…</> : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

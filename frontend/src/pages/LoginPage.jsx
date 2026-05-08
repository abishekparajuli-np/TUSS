import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password);
      toast.success('Logged in successfully');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">

      <div className="relative z-10 w-full max-w-md">
        {/* Card */}
        <div className="glow-card rounded-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-4xl font-bold text-[#00ffc8] mb-2 font-mono">
              ≈∞≈
            </div>
            <h1 className="text-3xl font-bold text-[#e0f7fa] font-mono mb-2">
              THERMASCAN AI
            </h1>
            <p className="text-[#546e7a] font-mono text-sm">
              Authorized Clinical Personnel Only
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-xs font-mono text-[#546e7a] mb-2">
                EMAIL
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@clinic.com"
                className="input-base w-full"
                required
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-mono text-[#546e7a] mb-2">
                PASSWORD
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-base w-full"
                required
                disabled={loading}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-6 font-bold uppercase tracking-wide"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          {/* Footer */}
          <div className="text-center mt-6 text-xs font-mono text-[#546e7a]">
            <p>Accounts provisioned by administrator</p>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { login, isAuthenticated } from '../utils/auth'

const isProd = Boolean((import.meta as any)?.env?.PROD)
const BACKEND_URL = isProd
  ? 'https://sandbox-backend-977058061007.us-east1.run.app'
  : 'http://localhost:8081'

type LocationState = {
  from?: string
}

const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { from } = (location.state as LocationState) || {}
  const redirectTarget = useMemo(() => from || '/studio', [from])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // If user is already authenticated, send them straight to the studio
  useEffect(() => {
    if (isAuthenticated()) {
      navigate(redirectTarget, { replace: true })
    }
  }, [navigate, redirectTarget])

  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!email || !password) {
      setError('Email and password are required.')
      return
    }

    try {
      setIsSubmitting(true)
      await login(email, password, BACKEND_URL)
      navigate(redirectTarget, { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      setError(message)
      setIsSubmitting(false)
    }
  }, [email, password, navigate, redirectTarget])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl">
        <div className="mb-6 text-center space-y-2">
          <h1 className="text-2xl font-semibold text-white">Sign in to Election Analytics Sandbox</h1>
          <p className="text-sm text-slate-400">
            Access the Simulation Studio, scenario library, and real-time playback controls.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-200">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-200">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-700/40"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-500">
          Need an account? Contact <a className="text-blue-400 hover:text-blue-300" href="mailto:invest@electionanalytics.com">invest@electionanalytics.com</a>
        </div>

        <div className="mt-4 text-center">
          <Link to="/" className="text-sm text-slate-400 hover:text-white">
            ← Back to landing page
          </Link>
        </div>
      </div>
    </div>
  )
}

export default LoginPage

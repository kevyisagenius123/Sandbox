import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { isAuthenticated } from '../../utils/auth'

/**
 * Simple guard component to ensure routes require authentication.
 * Redirects unauthenticated users to the login page.
 */
const ProtectedRoute: React.FC = () => {
  const location = useLocation()

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

export default ProtectedRoute

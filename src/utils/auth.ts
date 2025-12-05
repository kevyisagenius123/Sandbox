/**
 * Authentication utility for managing JWT tokens
 */

const TOKEN_KEY = 'sandbox_auth_token'
const USER_KEY = 'sandbox_user_data'

export interface UserData {
  userId: string
  email: string
  username: string
  role: string
  subscriptionTier: string
}

/**
 * Store authentication token and user data in localStorage
 */
export function setAuthToken(token: string, userData: UserData): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(userData))
}

/**
 * Get authentication token from localStorage
 */
export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

/**
 * Get user data from localStorage
 */
export function getUserData(): UserData | null {
  const data = localStorage.getItem(USER_KEY)
  if (!data) return null
  
  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

/**
 * Clear authentication data from localStorage
 */
export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getAuthToken()
}

/**
 * Create authenticated fetch wrapper that automatically adds Authorization header
 */
export async function authenticatedFetch(
  url: string, 
  options: RequestInit = {}
): Promise<Response> {
  const token = getAuthToken()
  
  const headers = new Headers(options.headers)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  
  const response = await fetch(url, {
    ...options,
    headers
  })
  
  // Handle 401 Unauthorized - token expired or invalid
  if (response.status === 401) {
    clearAuth()
    // Redirect to login page or show auth modal
    window.location.href = '/login' // Adjust based on your routing
  }
  
  return response
}

/**
 * Login user and store token
 */
export async function login(email: string, password: string, backendUrl: string): Promise<UserData> {
  const response = await fetch(`${backendUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Login failed' }))
    throw new Error(error.error || 'Login failed')
  }
  
  const data = await response.json()
  
  const userData: UserData = {
    userId: data.userId,
    email: data.email,
    username: data.username,
    role: data.role,
    subscriptionTier: data.subscriptionTier
  }
  
  setAuthToken(data.token, userData)
  return userData
}

/**
 * Register new user and store token
 */
export async function register(
  email: string, 
  username: string, 
  password: string,
  backendUrl: string
): Promise<UserData> {
  const response = await fetch(`${backendUrl}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, username, password })
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Registration failed' }))
    throw new Error(error.error || 'Registration failed')
  }
  
  const data = await response.json()
  
  const userData: UserData = {
    userId: data.userId,
    email: data.email,
    username: data.username,
    role: data.role || 'USER',
    subscriptionTier: data.subscriptionTier
  }
  
  setAuthToken(data.token, userData)
  return userData
}

/**
 * Logout user and clear token
 */
export function logout(): void {
  clearAuth()
}

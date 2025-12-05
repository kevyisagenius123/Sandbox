import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setAuthToken,
  getAuthToken,
  clearAuth,
  login,
  register,
  logout,
  authenticatedFetch,
} from '../utils/auth';

describe('Auth Utility', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset fetch mock
    vi.clearAllMocks();
  });

  describe('Token Storage', () => {
    it('should store auth token in localStorage', () => {
      const token = 'test-jwt-token';
      const userData = { userId: '1', email: 'test@test.com', username: 'test', role: 'user', subscriptionTier: 'free' };
      setAuthToken(token, userData);
      expect(localStorage.getItem('sandbox_auth_token')).toBe(token);
    });

    it('should retrieve auth token from localStorage', () => {
      const token = 'test-jwt-token';
      localStorage.setItem('sandbox_auth_token', token);
      expect(getAuthToken()).toBe(token);
    });

    it('should return null when no token exists', () => {
      expect(getAuthToken()).toBeNull();
    });

    it('should clear auth token from localStorage', () => {
      const token = 'test-token';
      const userData = { userId: '1', email: 'test@test.com', username: 'test', role: 'user', subscriptionTier: 'free' };
      setAuthToken(token, userData);
      clearAuth();
      expect(localStorage.getItem('sandbox_auth_token')).toBeNull();
    });
  });

  describe('Login', () => {
    it('should successfully login with valid credentials', async () => {
      const mockResponse = {
        token: 'jwt-token-123',
        userId: 'user-id-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'USER',
        subscriptionTier: 'FREE',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await login('test@example.com', 'password123');

      expect(result).toEqual(mockResponse);
      expect(localStorage.getItem('sandbox_auth_token')).toBe('jwt-token-123');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/login'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'password123',
          }),
        })
      );
    });

    it('should throw error on login failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Invalid credentials' }),
      });

      await expect(login('test@example.com', 'wrongpassword')).rejects.toThrow(
        'Login failed'
      );
    });
  });

  describe('Register', () => {
    it('should successfully register new user', async () => {
      const mockResponse = {
        token: 'jwt-token-456',
        userId: 'user-id-456',
        email: 'newuser@example.com',
        username: 'newuser',
        role: 'USER',
        subscriptionTier: 'FREE',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await register(
        'newuser@example.com',
        'newuser',
        'password123'
      );

      expect(result).toEqual(mockResponse);
      expect(localStorage.getItem('sandbox_auth_token')).toBe('jwt-token-456');
    });

    it('should throw error on registration failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Email already exists' }),
      });

      await expect(
        register('existing@example.com', 'user', 'password123')
      ).rejects.toThrow('Registration failed');
    });
  });

  describe('Logout', () => {
    it('should clear auth token on logout', () => {
      localStorage.setItem('authToken', 'test-token');
      logout();
      expect(localStorage.getItem('authToken')).toBeNull();
    });
  });

  describe('Authenticated Fetch', () => {
    it('should include Authorization header when token exists', async () => {
      localStorage.setItem('authToken', 'test-token-789');

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'success' }),
      });

      await authenticatedFetch('/api/test', { method: 'GET' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-789',
          }),
        })
      );
    });

    it('should redirect to login on 401 response', async () => {
      localStorage.setItem('authToken', 'expired-token');
      delete (window as any).location;
      (window as any).location = { href: '' };

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      await expect(authenticatedFetch('/api/test')).rejects.toThrow();
      expect(localStorage.getItem('authToken')).toBeNull();
    });

    it('should work without token (for public endpoints)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'public' }),
      });

      await authenticatedFetch('/api/public');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/public'),
        expect.objectContaining({
          headers: expect.not.objectContaining({
            Authorization: expect.anything(),
          }),
        })
      );
    });
  });
});

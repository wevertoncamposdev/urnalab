import { authController } from '../controllers/auth.controller.js';

const FIFTEEN_MIN = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

export function registerAuthRoutes(router) {
  router.post('/api/auth/register', authController.register, {
    public: true,
    rateLimit: { windowMs: ONE_HOUR, max: 5 },
  });
  router.post('/api/auth/login', authController.login, {
    public: true,
    rateLimit: { windowMs: FIFTEEN_MIN, max: 10 },
  });
  router.post('/api/auth/verify-email', authController.verifyEmail, {
    public: true,
    rateLimit: { windowMs: FIFTEEN_MIN, max: 10 },
  });
  router.post('/api/auth/resend-verification', authController.resendVerification, {
    public: true,
    rateLimit: { windowMs: ONE_HOUR, max: 5 },
  });
  router.post('/api/auth/forgot-password', authController.forgotPassword, {
    public: true,
    rateLimit: { windowMs: ONE_HOUR, max: 5 },
  });
  router.post('/api/auth/reset-password', authController.resetPassword, {
    public: true,
    rateLimit: { windowMs: FIFTEEN_MIN, max: 10 },
  });
  router.get('/api/auth/me', authController.me);
  router.post('/api/auth/change-password', authController.changePassword, {
    rateLimit: { windowMs: FIFTEEN_MIN, max: 10 },
  });
}

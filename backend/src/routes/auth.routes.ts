import { Router } from "express";
import { register, login, me, logout, verifyOTP, oauthCallback, mockOAuthLogin } from "../controllers/auth.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import passport from "passport";

const router = Router();

router.post("/register", register);
router.post("/verify-otp", verifyOTP);
router.post("/login", login);
router.get("/me", requireAuth, me);
router.post("/logout", logout);

// Check if we are running without real API keys
const isMock = !process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID === "PLACEHOLDER_GOOGLE_CLIENT_ID";

// Mock Route
router.get("/mock/:provider", mockOAuthLogin);

// --- OAuth Routes ---
// Google
router.get("/google", (req, res, next) => {
  if (isMock) return res.redirect("/api/auth/mock/google");
  passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});
router.get("/google/callback", passport.authenticate("google", { session: false, failureRedirect: "/login?error=oauth_failed" }), oauthCallback);

// Facebook
router.get("/facebook", (req, res, next) => {
  if (isMock) return res.redirect("/api/auth/mock/facebook");
  passport.authenticate("facebook", { scope: ["email"] })(req, res, next);
});
router.get("/facebook/callback", passport.authenticate("facebook", { session: false, failureRedirect: "/login?error=oauth_failed" }), oauthCallback);

// Apple
router.get("/apple", (req, res, next) => {
  if (isMock) return res.redirect("/api/auth/mock/apple");
  passport.authenticate("apple")(req, res, next);
});
router.post("/apple/callback", passport.authenticate("apple", { session: false, failureRedirect: "/login?error=oauth_failed" }), oauthCallback);

export default router;

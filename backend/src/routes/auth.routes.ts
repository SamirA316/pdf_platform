import { Router } from "express";
import { register, login, me, logout, verifyOTP } from "../controllers/auth.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.post("/register", register);
router.post("/verify-otp", verifyOTP);
router.post("/login", login);
router.get("/me", requireAuth, me);
router.post("/logout", logout);

export default router;

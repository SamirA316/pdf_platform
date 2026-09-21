import "dotenv/config";
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer, { Transporter } from "nodemailer";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-jwt-key-replace-in-production";

let transporter: Transporter;

const getTransporter = (): Transporter => {
  if (transporter) return transporter;

  const isSmtpConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_PASS !== "your_app_password_here");

  if (isSmtpConfigured) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    console.log("Transporter initialized with Real SMTP Server (Gmail)");
  } else {
    console.log("Falling back to standard nodemailer transporter...");
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      auth: {
        user: "ethereal@example.com",
        pass: "ethereal",
      },
    });
  }
  return transporter;
};

const generateToken = (id: string) => {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: "7d" });
};

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: "All fields are required" });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      if (existingUser.isVerified) {
        res.status(400).json({ error: "Email already registered. Please log in." });
        return;
      }

      // If user exists but is NOT verified, update their OTP and resend it
      const otp = generateOTP();
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      const hashedPassword = await bcrypt.hash(password, 10);

      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name,
          password: hashedPassword,
          otp,
          otpExpires,
        },
      });

      console.log(`\n========================================`);
      console.log(`🔑 [OTP RESENT] Code for ${email}: ${otp}`);
      console.log(`========================================\n`);

      const mailer = getTransporter();
      await mailer.sendMail({
        from: process.env.EMAIL_FROM || '"PDF Platform" <pdfplatform382@gmail.com>',
        to: email,
        subject: "Verify your email - PDF Platform",
        text: `Your verification code is: ${otp}`,
        html: `<b>Your verification code is: ${otp}</b>`,
      });

      res.status(200).json({ message: "New OTP sent to your email", userId: existingUser.id });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        otp,
        otpExpires,
        isVerified: false,
      },
    });

    console.log(`\n========================================`);
    console.log(`🔑 [NEW OTP] Code for ${email}: ${otp}`);
    console.log(`========================================\n`);

    const mailer = getTransporter();
    await mailer.sendMail({
      from: process.env.EMAIL_FROM || '"PDF Platform" <pdfplatform382@gmail.com>',
      to: email,
      subject: "Verify your email - PDF Platform",
      text: `Your verification code is: ${otp}`,
      html: `<b>Your verification code is: ${otp}</b>`,
    });

    res.status(201).json({ message: "OTP sent to your email", userId: user.id });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const verifyOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      res.status(400).json({ error: "Email and OTP are required" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.isVerified) {
      // User is already verified, log them in directly
      const token = generateToken(user.id);
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.status(200).json({ user: { id: user.id, name: user.name, email: user.email } });
      return;
    }

    if (user.otp !== otp) {
      res.status(400).json({ error: "Invalid OTP" });
      return;
    }

    if (!user.otpExpires || user.otpExpires < new Date()) {
      res.status(400).json({ error: "OTP has expired" });
      return;
    }

    // Mark as verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        otp: null,
        otpExpires: null,
      },
    });

    const token = generateToken(user.id);
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    if (!user.isVerified) {
      res.status(403).json({ error: "Please verify your email before logging in" });
      return;
    }
    if (!user.password) {
      res.status(400).json({ error: "Please login with OAuth provider" });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = generateToken(user.id);
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export interface AuthRequest extends Request {
  userId?: string;
}

export const me = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error("Me route error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const logout = (req: Request, res: Response): void => {
  res.clearCookie("token");
  res.status(200).json({ message: "Logged out successfully" });
};

export const mockOAuthLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const provider = (req.params.provider as string)?.toUpperCase();
    const email = `${provider.toLowerCase()}.user@example.com`;

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: `${provider} User`,
          email,
          password: "",
          isVerified: true,
        },
      });
    }

    const token = generateToken(user.id);
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect(process.env.FRONTEND_URL || "http://localhost:3000");
  } catch (error) {
    console.error("Mock OAuth error:", error);
    res.redirect((process.env.FRONTEND_URL || "http://localhost:3000") + "/login?error=oauth_failed");
  }
};

export const oauthCallback = (req: Request, res: Response): void => {
  try {
    const user = req.user as any;
    if (!user) {
      res.redirect(process.env.FRONTEND_URL + "/login?error=oauth_failed");
      return;
    }

    const token = generateToken(user.id);
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Redirect to frontend dashboard or home
    res.redirect(process.env.FRONTEND_URL || "http://localhost:3000");
  } catch (error) {
    console.error("OAuth callback error:", error);
    res.redirect((process.env.FRONTEND_URL || "http://localhost:3000") + "/login?error=oauth_failed");
  }
};

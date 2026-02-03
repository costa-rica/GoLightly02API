import { Router, Request, Response, NextFunction } from "express";
import { User } from "mantrify01db";
import { hashPassword, comparePassword } from "../modules/passwordHash";
import {
  generateAccessToken,
  generateEmailVerificationToken,
  verifyEmailVerificationToken,
  generatePasswordResetToken,
  verifyPasswordResetToken,
} from "../modules/jwt";
import { sendVerificationEmail, sendPasswordResetEmail } from "../modules/emailService";
import { AppError, ErrorCodes } from "../modules/errorHandler";
import logger from "../modules/logger";

const router = Router();

// POST /users/register
router.post(
  "/register",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      // Validate input
      if (!email || !password) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          "Email and password are required",
          400
        );
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          "Invalid email format",
          400
        );
      }

      // Validate password length
      if (password.length < 6) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          "Password must be at least 6 characters long",
          400
        );
      }

      // Normalize email to lowercase
      const normalizedEmail = email.toLowerCase();

      // Check if user already exists
      const existingUser = await User.findOne({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        throw new AppError(
          ErrorCodes.CONFLICT,
          "User with this email already exists",
          409
        );
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create user
      const user = await User.create({
        email: normalizedEmail,
        password: hashedPassword,
        isEmailVerified: false,
        isAdmin: false,
      });

      logger.info(`New user registered: ${normalizedEmail}`);

      // Generate email verification token
      const verificationToken = generateEmailVerificationToken(
        user.id as number,
        user.email as string
      );

      // Send verification email
      await sendVerificationEmail(normalizedEmail, verificationToken);

      res.status(201).json({
        message:
          "Registration successful. Please check your email to verify your account.",
        userId: user.id,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /users/verify
router.get(
  "/verify",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.query;

      // Validate token exists
      if (!token || typeof token !== "string") {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          "Verification token is required",
          400
        );
      }

      // Verify and decode token
      let payload;
      try {
        payload = verifyEmailVerificationToken(token);
      } catch (error: any) {
        if (error.name === "TokenExpiredError") {
          throw new AppError(
            ErrorCodes.TOKEN_EXPIRED,
            "Verification token has expired. Please request a new verification email.",
            401
          );
        } else {
          throw new AppError(
            ErrorCodes.INVALID_TOKEN,
            "Invalid verification token",
            401
          );
        }
      }

      // Find user
      const user = await User.findByPk(payload.userId);

      if (!user) {
        throw new AppError(ErrorCodes.USER_NOT_FOUND, "User not found", 404);
      }

      // Check if already verified
      if (user.isEmailVerified) {
        return res.status(200).json({
          message: "Email is already verified. You can now log in.",
        });
      }

      // Update user verification status
      await User.update(
        {
          isEmailVerified: true,
          emailVerifiedAt: new Date(),
        },
        {
          where: { id: payload.userId },
        }
      );

      logger.info(`Email verified for user: ${user.email}`);

      res.status(200).json({
        message: "Email verified successfully. You can now log in.",
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /users/login
router.post(
  "/login",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      // Validate input
      if (!email || !password) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          "Email and password are required",
          400
        );
      }

      // Normalize email
      const normalizedEmail = email.toLowerCase();

      // Find user
      const user = await User.findOne({
        where: { email: normalizedEmail },
      });

      if (!user) {
        throw new AppError(
          ErrorCodes.AUTH_FAILED,
          "Invalid email or password",
          401
        );
      }

      // Check if email is verified
      if (!user.isEmailVerified) {
        throw new AppError(
          ErrorCodes.EMAIL_NOT_VERIFIED,
          "Please verify your email before logging in",
          403
        );
      }

      // Compare password
      const isPasswordValid = await comparePassword(
        password,
        user.password as string
      );

      if (!isPasswordValid) {
        throw new AppError(
          ErrorCodes.AUTH_FAILED,
          "Invalid email or password",
          401
        );
      }

      // Generate access token
      const accessToken = generateAccessToken(
        user.id as number,
        user.email as string
      );

      logger.info(`User logged in: ${user.email}`);

      res.status(200).json({
        message: "Login successful",
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          isAdmin: user.isAdmin,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /users/forgot-password
router.post(
  "/forgot-password",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;

      // Validate input
      if (!email) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          "Email is required",
          400
        );
      }

      // Normalize email
      const normalizedEmail = email.toLowerCase();

      // Find user
      const user = await User.findOne({
        where: { email: normalizedEmail },
      });

      // If user doesn't exist, return error
      if (!user) {
        throw new AppError(
          ErrorCodes.USER_NOT_FOUND,
          "No account found with this email address",
          404
        );
      }

      // Generate password reset token
      const resetToken = generatePasswordResetToken(
        user.id as number,
        user.email as string
      );

      // Send password reset email
      await sendPasswordResetEmail(normalizedEmail, resetToken);

      logger.info(`Password reset email sent to ${normalizedEmail}`);

      res.status(200).json({
        message: "Password reset link has been sent to your email address",
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /users/reset-password
router.post(
  "/reset-password",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, newPassword } = req.body;

      // Validate input
      if (!token || !newPassword) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          "Token and new password are required",
          400
        );
      }

      // Validate password length
      if (newPassword.length < 6) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          "Password must be at least 6 characters long",
          400
        );
      }

      // Verify and decode token
      let payload;
      try {
        payload = verifyPasswordResetToken(token);
      } catch (error: any) {
        if (error.name === "TokenExpiredError") {
          throw new AppError(
            ErrorCodes.TOKEN_EXPIRED,
            "Password reset token has expired. Please request a new password reset.",
            401
          );
        } else {
          throw new AppError(
            ErrorCodes.INVALID_TOKEN,
            "Invalid password reset token",
            401
          );
        }
      }

      // Find user
      const user = await User.findByPk(payload.userId);

      if (!user) {
        throw new AppError(ErrorCodes.USER_NOT_FOUND, "User not found", 404);
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);

      // Update user password
      await User.update(
        {
          password: hashedPassword,
        },
        {
          where: { id: payload.userId },
        }
      );

      logger.info(`Password reset successful for user: ${user.email}`);

      res.status(200).json({
        message: "Password has been reset successfully. You can now log in with your new password.",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

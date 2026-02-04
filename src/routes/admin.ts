import { Router, Request, Response, NextFunction } from "express";
import {
  User,
  Mantra,
  ContractUserMantraListen,
} from "mantrify01db";
import { authMiddleware } from "../modules/authMiddleware";
import { AppError, ErrorCodes } from "../modules/errorHandler";
import logger from "../modules/logger";
import fs from "fs";
import path from "path";

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Middleware to check if user is admin
const adminMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError(
        ErrorCodes.AUTH_FAILED,
        "Authentication required",
        401
      );
    }

    // Find user and check isAdmin status
    const user = await User.findByPk(userId);

    if (!user) {
      throw new AppError(ErrorCodes.AUTH_FAILED, "User not found", 401);
    }

    const isAdmin = user.get("isAdmin") as boolean;

    if (!isAdmin) {
      throw new AppError(
        ErrorCodes.UNAUTHORIZED_ACCESS,
        "Admin access required",
        403
      );
    }

    next();
  } catch (error: any) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error(`Admin middleware error: ${error.message}`);
      next(
        new AppError(
          ErrorCodes.INTERNAL_ERROR,
          "Failed to verify admin status",
          500,
          error.message
        )
      );
    }
  }
};

// Apply admin middleware to all routes
router.use(adminMiddleware);

// GET /admin/users
router.get(
  "/users",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Query all users excluding password field
      const users = await User.findAll({
        attributes: [
          "id",
          "email",
          "isEmailVerified",
          "emailVerifiedAt",
          "isAdmin",
          "createdAt",
          "updatedAt",
        ],
      });

      logger.info(
        `Admin user ${req.user?.userId} retrieved ${users.length} users`
      );

      res.status(200).json({
        users,
      });
    } catch (error: any) {
      logger.error(`Failed to retrieve users: ${error.message}`);
      next(
        new AppError(
          ErrorCodes.INTERNAL_ERROR,
          "Failed to retrieve users",
          500,
          error.message
        )
      );
    }
  }
);

// GET /admin/mantras
router.get(
  "/mantras",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get ALL mantras regardless of visibility
      const mantras = await Mantra.findAll();

      // Calculate listens for each mantra
      const mantrasWithListens = await Promise.all(
        mantras.map(async (mantra) => {
          const mantraId = mantra.get("id") as number;

          // Get all listen records for this mantra
          const listenRecords = await ContractUserMantraListen.findAll({
            where: {
              mantraId,
            },
          });

          // Sum up the listen counts
          const totalListens = listenRecords.reduce(
            (sum: number, record: any) => {
              const listenCount = record.get("listenCount") as number;
              return sum + (listenCount || 0);
            },
            0
          );

          // Return mantra with all fields plus listens
          return {
            ...mantra.get({ plain: true }),
            listens: totalListens,
          };
        })
      );

      logger.info(
        `Admin user ${req.user?.userId} retrieved ${mantrasWithListens.length} mantras (all)`
      );

      res.status(200).json({
        mantras: mantrasWithListens,
      });
    } catch (error: any) {
      logger.error(`Failed to retrieve mantras: ${error.message}`);
      next(
        new AppError(
          ErrorCodes.INTERNAL_ERROR,
          "Failed to retrieve mantras",
          500,
          error.message
        )
      );
    }
  }
);

// DELETE /admin/mantras/:mantraId
router.delete(
  "/mantras/:mantraId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const mantraId = parseInt(req.params.mantraId, 10);

      // Validate ID
      if (isNaN(mantraId)) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          "Invalid mantra ID",
          400
        );
      }

      // Find mantra in database
      const mantra = await Mantra.findByPk(mantraId);

      if (!mantra) {
        throw new AppError(
          ErrorCodes.MANTRA_NOT_FOUND,
          "Mantra not found",
          404
        );
      }

      // Get file path components from database
      const dbFilePath = mantra.get("filePath") as string | null;
      const filename = mantra.get("filename") as string | null;

      // Delete MP3 file if it exists
      if (filename) {
        let fullFilePath: string;

        if (dbFilePath) {
          // If DB has directory path, combine with filename
          fullFilePath = path.join(dbFilePath, filename);
        } else {
          // Fallback to PATH_MP3_OUTPUT + filename
          const outputPath = process.env.PATH_MP3_OUTPUT;
          if (!outputPath) {
            throw new AppError(
              ErrorCodes.INTERNAL_ERROR,
              "Mantra output path not configured",
              500
            );
          }
          fullFilePath = path.join(outputPath, filename);
        }

        if (fs.existsSync(fullFilePath)) {
          try {
            fs.unlinkSync(fullFilePath);
            logger.info(`Admin deleted mantra file: ${fullFilePath}`);
          } catch (error: any) {
            logger.error(
              `Failed to delete mantra file ${fullFilePath}: ${error.message}`
            );
            throw new AppError(
              ErrorCodes.INTERNAL_ERROR,
              "Failed to delete mantra file",
              500,
              error.message
            );
          }
        } else {
          logger.warn(
            `Mantra file not found for deletion: ${fullFilePath}. Proceeding with database deletion.`
          );
        }
      }

      // Delete mantra from database
      await mantra.destroy();

      logger.info(
        `Admin user ${req.user?.userId} deleted mantra ${mantraId}`
      );

      res.status(200).json({
        message: "Mantra deleted successfully",
        mantraId,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        next(error);
      } else {
        logger.error(
          `Failed to delete mantra ${req.params.mantraId}: ${error.message}`
        );
        next(
          new AppError(
            ErrorCodes.INTERNAL_ERROR,
            "Failed to delete mantra",
            500,
            error.message
          )
        );
      }
    }
  }
);

export default router;

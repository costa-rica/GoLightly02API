import { Router, Request, Response, NextFunction } from "express";
import { SoundFiles } from "mantrify01db";
import { authMiddleware } from "../modules/authMiddleware";
import { AppError, ErrorCodes } from "../modules/errorHandler";
import logger from "../modules/logger";

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// GET /sounds/sound_files
router.get(
  "/sound_files",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Query all sound files from the database
      const soundFiles = await SoundFiles.findAll({
        attributes: ["id", "name", "description", "filename"],
      });

      logger.info(
        `Sound files retrieved for user ${req.user?.userId}: ${soundFiles.length} files`
      );

      res.status(200).json({
        soundFiles,
      });
    } catch (error: any) {
      logger.error(`Failed to retrieve sound files: ${error.message}`);
      next(
        new AppError(
          ErrorCodes.INTERNAL_ERROR,
          "Failed to retrieve sound files",
          500,
          error.message
        )
      );
    }
  }
);

export default router;

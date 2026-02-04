import { Router, Request, Response, NextFunction } from "express";
import { SoundFiles, Mantra, ContractUsersMantras } from "mantrify01db";
import { authMiddleware } from "../modules/authMiddleware";
import { AppError, ErrorCodes } from "../modules/errorHandler";
import logger from "../modules/logger";
import multer from "multer";
import fs from "fs";
import path from "path";
import {
  sanitizeFilename,
  isMP3File,
  getFilenameWithoutExtension,
} from "../modules/fileUpload";

const router = Router();

// Configure multer for memory storage (we'll validate before saving to disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

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

// POST /sounds/upload
router.post(
  "/upload",
  upload.single("file"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if file was uploaded
      if (!req.file) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          "No file uploaded",
          400
        );
      }

      // Validate file is MP3
      if (!isMP3File(req.file.originalname)) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          "Only .mp3 files are allowed",
          400
        );
      }

      // Sanitize filename
      const sanitizedFilename = sanitizeFilename(req.file.originalname);

      // Get name and description from request body
      const { name, description } = req.body;

      // Use filename without extension as name if not provided
      const soundName = name || getFilenameWithoutExtension(sanitizedFilename);

      // Check if filename already exists in database
      const existingDbEntry = await SoundFiles.findOne({
        where: { filename: sanitizedFilename },
      });

      if (existingDbEntry) {
        logger.warn(
          `Upload attempt failed: filename ${sanitizedFilename} already exists in database`
        );
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          `A sound file with the name "${sanitizedFilename}" already exists`,
          409
        );
      }

      // Get output path from environment
      const outputPath = process.env.PATH_MP3_SOUND_FILES;
      if (!outputPath) {
        throw new AppError(
          ErrorCodes.INTERNAL_ERROR,
          "Sound files path not configured",
          500
        );
      }

      // Check if file already exists on filesystem
      const filePath = path.join(outputPath, sanitizedFilename);
      if (fs.existsSync(filePath)) {
        logger.warn(
          `Upload attempt failed: file ${sanitizedFilename} already exists on filesystem`
        );
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          `A file with the name "${sanitizedFilename}" already exists on the server`,
          409
        );
      }

      // Save file to disk
      try {
        fs.writeFileSync(filePath, req.file.buffer);
        logger.info(
          `Sound file saved to disk: ${filePath} (${req.file.size} bytes)`
        );
      } catch (error: any) {
        logger.error(`Failed to save file to disk: ${error.message}`);
        throw new AppError(
          ErrorCodes.INTERNAL_ERROR,
          "Failed to save file to server",
          500,
          error.message
        );
      }

      // Create database entry
      try {
        const soundFile = await SoundFiles.create({
          name: soundName,
          description: description || null,
          filename: sanitizedFilename,
        });

        logger.info(
          `Sound file uploaded successfully by user ${req.user?.userId}: ${sanitizedFilename} (ID: ${soundFile.id})`
        );

        res.status(201).json({
          message: "Sound file uploaded successfully",
          soundFile: {
            id: soundFile.id,
            name: soundFile.name,
            description: soundFile.description,
            filename: soundFile.filename,
          },
        });
      } catch (error: any) {
        // If database insert fails, delete the file we just saved
        try {
          fs.unlinkSync(filePath);
          logger.info(`Cleaned up file after database error: ${filePath}`);
        } catch (cleanupError: any) {
          logger.error(
            `Failed to cleanup file after database error: ${cleanupError.message}`
          );
        }

        logger.error(`Failed to create database entry: ${error.message}`);
        throw new AppError(
          ErrorCodes.INTERNAL_ERROR,
          "Failed to save sound file information",
          500,
          error.message
        );
      }
    } catch (error: any) {
      if (error instanceof AppError) {
        next(error);
      } else {
        logger.error(`Upload failed: ${error.message}`);
        next(
          new AppError(
            ErrorCodes.INTERNAL_ERROR,
            "Failed to upload sound file",
            500,
            error.message
          )
        );
      }
    }
  }
);

// DELETE /sounds/sound_file/:id
router.delete(
  "/sound_file/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const soundFileId = parseInt(req.params.id, 10);

      // Validate ID
      if (isNaN(soundFileId)) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          "Invalid sound file ID",
          400
        );
      }

      // Get deleteLinkedMantras from request body
      const { deleteLinkedMantras } = req.body;
      const shouldDeleteLinkedMantras = deleteLinkedMantras === true;

      // Find sound file in database
      const soundFile = await SoundFiles.findByPk(soundFileId);

      if (!soundFile) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          "Sound file not found",
          404
        );
      }

      const filename = soundFile.filename as string;

      // Find all mantras that use this sound file
      // Check if mantraArray contains an element with this sound_file
      const allMantras = await Mantra.findAll();
      const linkedMantras = allMantras.filter((mantra) => {
        const mantraArray = mantra.get("mantraArray") as any[];
        if (!Array.isArray(mantraArray)) return false;

        return mantraArray.some(
          (element) => element.sound_file === filename
        );
      });

      // If mantras are using this sound file and deleteLinkedMantras is false
      if (linkedMantras.length > 0 && !shouldDeleteLinkedMantras) {
        logger.warn(
          `Cannot delete sound file ${filename}: used by ${linkedMantras.length} mantra(s)`
        );
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          `Cannot delete sound file because it is being used by mantras`,
          409,
          `This sound file is used by ${linkedMantras.length} mantra(s). Set deleteLinkedMantras to true to delete them.`
        );
      }

      // Delete linked mantras if requested
      if (linkedMantras.length > 0 && shouldDeleteLinkedMantras) {
        logger.info(
          `Deleting ${linkedMantras.length} mantra(s) linked to sound file ${filename}`
        );

        const outputPath = process.env.PATH_MP3_OUTPUT;
        if (!outputPath) {
          throw new AppError(
            ErrorCodes.INTERNAL_ERROR,
            "Mantra output path not configured",
            500
          );
        }

        for (const mantra of linkedMantras) {
          const mantraId = mantra.get("id") as number;
          const mantraFilename = mantra.get("filename") as string | null;

          // Delete mantra file if it exists
          if (mantraFilename) {
            const mantraFilePath = path.join(outputPath, mantraFilename);

            if (fs.existsSync(mantraFilePath)) {
              try {
                fs.unlinkSync(mantraFilePath);
                logger.info(`Deleted mantra file: ${mantraFilePath}`);
              } catch (error: any) {
                logger.error(
                  `Failed to delete mantra file ${mantraFilePath}: ${error.message}`
                );
              }
            }
          }

          // Delete mantra from database
          await mantra.destroy();
          logger.info(`Deleted mantra ${mantraId} linked to sound file ${filename}`);
        }
      }

      // Delete sound file from filesystem
      const soundFilesPath = process.env.PATH_MP3_SOUND_FILES;
      if (!soundFilesPath) {
        throw new AppError(
          ErrorCodes.INTERNAL_ERROR,
          "Sound files path not configured",
          500
        );
      }

      const soundFilePath = path.join(soundFilesPath, filename);
      if (fs.existsSync(soundFilePath)) {
        try {
          fs.unlinkSync(soundFilePath);
          logger.info(`Deleted sound file: ${soundFilePath}`);
        } catch (error: any) {
          logger.error(
            `Failed to delete sound file ${soundFilePath}: ${error.message}`
          );
          throw new AppError(
            ErrorCodes.INTERNAL_ERROR,
            "Failed to delete sound file from server",
            500,
            error.message
          );
        }
      } else {
        logger.warn(
          `Sound file not found on filesystem: ${soundFilePath}. Proceeding with database deletion.`
        );
      }

      // Delete sound file from database
      await soundFile.destroy();

      logger.info(
        `Sound file ${soundFileId} deleted by user ${req.user?.userId}${
          linkedMantras.length > 0
            ? ` (with ${linkedMantras.length} linked mantra(s))`
            : ""
        }`
      );

      res.status(200).json({
        message: "Sound file deleted successfully",
        soundFileId,
        deletedMantrasCount: linkedMantras.length,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        next(error);
      } else {
        logger.error(
          `Failed to delete sound file ${req.params.id}: ${error.message}`
        );
        next(
          new AppError(
            ErrorCodes.INTERNAL_ERROR,
            "Failed to delete sound file",
            500,
            error.message
          )
        );
      }
    }
  }
);

export default router;

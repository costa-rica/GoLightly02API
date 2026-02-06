import { Router, Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { authMiddleware } from "../modules/authMiddleware";
import { adminMiddleware } from "../modules/adminMiddleware";
import { AppError, ErrorCodes } from "../modules/errorHandler";
import logger from "../modules/logger";
import {
  ensureBackupDirectory,
  generateTimestamp,
  cleanupDirectory,
} from "../modules/database/filesystem";
import { createBackup, getAllTables } from "../modules/database/export";
import { zipDirectory } from "../modules/database/compression";

const router = Router();

// Apply authentication and admin middleware to all routes
router.use(authMiddleware);
router.use(adminMiddleware);

// POST /database/create-backup - Create database backup
router.post(
  "/create-backup",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info(
        `Admin user ${req.user?.userId} initiated database backup creation`,
      );

      const projectResourcesPath = process.env.PATH_PROJECT_RESOURCES;
      if (!projectResourcesPath) {
        throw new AppError(
          ErrorCodes.BACKUP_FAILED,
          "PATH_PROJECT_RESOURCES is not configured",
          500,
        );
      }

      const backupRoot = ensureBackupDirectory();
      const timestamp = generateTimestamp();
      const backupFolderName = `database_backup_${timestamp}`;
      const backupFolderPath = path.join(backupRoot, backupFolderName);
      const zipFilename = `${backupFolderName}.zip`;
      const zipPath = path.join(backupRoot, zipFilename);

      const cleanupNonZipFiles = () => {
        if (!fs.existsSync(backupRoot)) {
          return;
        }

        const entries = fs.readdirSync(backupRoot);
        for (const entry of entries) {
          if (entry.endsWith(".zip")) {
            continue;
          }

          const entryPath = path.join(backupRoot, entry);
          try {
            const stats = fs.statSync(entryPath);
            if (stats.isDirectory()) {
              fs.rmSync(entryPath, { recursive: true, force: true });
            } else {
              fs.unlinkSync(entryPath);
            }
          } catch (cleanupError: any) {
            logger.warn(
              `Failed to cleanup non-zip backup entry ${entryPath}: ${cleanupError.message}`,
            );
          }
        }
      };

      let tablesExported = 0;

      try {
        const tables = getAllTables();
        if (tables.length === 0) {
          throw new AppError(
            ErrorCodes.BACKUP_FAILED,
            "No tables found to export",
            500,
          );
        }

        fs.mkdirSync(backupFolderPath, { recursive: true });

        const backupResult = await createBackup(backupFolderPath);
        tablesExported = backupResult.tablesExported;

        await zipDirectory(backupFolderPath, zipPath);

        cleanupDirectory(backupFolderPath);
      } catch (error: any) {
        cleanupDirectory(backupFolderPath);

        if (fs.existsSync(zipPath)) {
          try {
            fs.unlinkSync(zipPath);
          } catch (cleanupError: any) {
            logger.warn(
              `Failed to remove partial zip file ${zipPath}: ${cleanupError.message}`,
            );
          }
        }

        cleanupNonZipFiles();
        throw error;
      }

      logger.info(
        `Database backup created: ${zipFilename} (${tablesExported} tables)`,
      );

      res.status(200).json({
        message: "Database backup created successfully",
        filename: zipFilename,
        path: zipPath,
        tablesExported,
        timestamp,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        next(error);
      } else {
        logger.error(`Failed to create backup: ${error.message}`);
        next(
          new AppError(
            ErrorCodes.BACKUP_FAILED,
            "Failed to create database backup",
            500,
            error.message,
          ),
        );
      }
    }
  },
);

// GET /database/backups-list - List all backup files
router.get(
  "/backups-list",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info(
        `Admin user ${req.user?.userId} requested backup list`,
      );

      // Implementation in Phase 4
      res.status(200).json({
        message: "Backups list endpoint - implementation pending",
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        next(error);
      } else {
        logger.error(`Failed to list backups: ${error.message}`);
        next(
          new AppError(
            ErrorCodes.INTERNAL_ERROR,
            "Failed to list backups",
            500,
            error.message,
          ),
        );
      }
    }
  },
);

// GET /database/download-backup/:filename - Download backup file
router.get(
  "/download-backup/:filename",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { filename } = req.params;
      logger.info(
        `Admin user ${req.user?.userId} requested backup download: ${filename}`,
      );

      // Implementation in Phase 5
      res.status(200).json({
        message: "Download backup endpoint - implementation pending",
        filename,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        next(error);
      } else {
        logger.error(`Failed to download backup: ${error.message}`);
        next(
          new AppError(
            ErrorCodes.BACKUP_NOT_FOUND,
            "Failed to download backup",
            500,
            error.message,
          ),
        );
      }
    }
  },
);

// DELETE /database/delete-backup/:filename - Delete backup file
router.delete(
  "/delete-backup/:filename",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { filename } = req.params;
      logger.info(
        `Admin user ${req.user?.userId} requested backup deletion: ${filename}`,
      );

      // Implementation in Phase 6
      res.status(200).json({
        message: "Delete backup endpoint - implementation pending",
        filename,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        next(error);
      } else {
        logger.error(`Failed to delete backup: ${error.message}`);
        next(
          new AppError(
            ErrorCodes.BACKUP_NOT_FOUND,
            "Failed to delete backup",
            500,
            error.message,
          ),
        );
      }
    }
  },
);

// POST /database/replenish-database - Restore database from backup
router.post(
  "/replenish-database",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info(
        `Admin user ${req.user?.userId} initiated database restoration`,
      );

      // Implementation in Phase 7
      res.status(200).json({
        message: "Replenish database endpoint - implementation pending",
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        next(error);
      } else {
        logger.error(`Failed to restore database: ${error.message}`);
        next(
          new AppError(
            ErrorCodes.RESTORE_FAILED,
            "Failed to restore database",
            500,
            error.message,
          ),
        );
      }
    }
  },
);

export default router;

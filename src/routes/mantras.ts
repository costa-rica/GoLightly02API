import { Router, Request, Response, NextFunction } from "express";
import {
  Mantra,
  ContractUsersMantras,
  ContractUserMantraListen,
} from "mantrify01db";
import { Op } from "sequelize";
import { authMiddleware } from "../modules/authMiddleware";
import { optionalAuthMiddleware } from "../modules/optionalAuthMiddleware";
import { AppError, ErrorCodes } from "../modules/errorHandler";
import logger from "../modules/logger";
import fs from "fs";
import path from "path";

// Interface for queuer response
interface QueuerResponse {
  success: boolean;
  queueId?: number;
  finalFilePath?: string;
  message?: string;
}

const router = Router();

// GET /mantras/:id/stream - Stream mantra MP3 file (optional authentication)
router.get(
  "/:id/stream",
  optionalAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const mantraId = parseInt(req.params.id, 10);

      // Validate ID
      if (isNaN(mantraId)) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          "Invalid mantra ID",
          400,
        );
      }

      // Find mantra in database
      const mantra = await Mantra.findByPk(mantraId);

      if (!mantra) {
        throw new AppError(
          ErrorCodes.MANTRA_NOT_FOUND,
          "Mantra not found",
          404,
        );
      }

      const visibility = mantra.get("visibility") as string;

      // Authorization check for private mantras
      if (visibility === "private") {
        // Private mantras require authentication
        if (!req.user) {
          throw new AppError(
            ErrorCodes.AUTH_FAILED,
            "Authentication required to access private mantras",
            401,
          );
        }

        // Verify ownership via ContractUsersMantras
        const ownership = await ContractUsersMantras.findOne({
          where: {
            userId: req.user.userId,
            mantraId: mantraId,
          },
        });

        if (!ownership) {
          throw new AppError(
            ErrorCodes.UNAUTHORIZED_ACCESS,
            "You do not have permission to access this mantra",
            403,
          );
        }
      }

      // Get file path components from database
      const dbFilePath = mantra.get("filePath") as string | null; // Directory path with trailing slash
      const filename = mantra.get("filename") as string | null;

      if (!filename) {
        throw new AppError(
          ErrorCodes.INTERNAL_ERROR,
          "Mantra file information not found",
          500,
        );
      }

      // Construct full file path
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
            500,
          );
        }
        fullFilePath = path.join(outputPath, filename);
      }

      // Verify file exists
      if (!fs.existsSync(fullFilePath)) {
        logger.error(`Mantra file not found: ${fullFilePath}`);
        throw new AppError(
          ErrorCodes.MANTRA_NOT_FOUND,
          "Mantra audio file not found",
          404,
        );
      }

      // Verify it's actually a file, not a directory
      const fileStats = fs.statSync(fullFilePath);
      if (!fileStats.isFile()) {
        logger.error(`Path is not a file: ${fullFilePath}`);
        throw new AppError(
          ErrorCodes.MANTRA_NOT_FOUND,
          "Mantra audio file not found",
          404,
        );
      }

      // Track listens
      if (req.user) {
        // Authenticated user - track in both tables
        const userId = req.user.userId;

        // Find or create ContractUserMantraListen record
        const [listenRecord, created] =
          await ContractUserMantraListen.findOrCreate({
            where: {
              userId,
              mantraId,
            },
            defaults: {
              userId,
              mantraId,
              listenCount: 1,
            },
          });

        // If record already existed, increment listenCount
        if (!created) {
          const currentCount = listenRecord.get("listenCount") as number;
          await listenRecord.update({
            listenCount: currentCount + 1,
          });
        }

        // Increment listens in Mantras table
        const currentListens = (mantra.get("listenCount") as number) || 0;
        await mantra.update({
          listenCount: currentListens + 1,
        });

        logger.info(
          `Mantra ${mantraId} streamed by user ${userId} (listen count: ${created ? 1 : (listenRecord.get("listenCount") as number)})`,
        );
      } else {
        // Anonymous user - only track in Mantras table
        const currentListens = (mantra.get("listenCount") as number) || 0;
        await mantra.update({
          listenCount: currentListens + 1,
        });

        logger.info(`Mantra ${mantraId} streamed anonymously`);
      }

      // Get file size from stats we already have
      const fileSize = fileStats.size;

      // Parse range header for seeking support
      const range = req.headers.range;

      if (range) {
        // Parse range header (e.g., "bytes=0-1023")
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        const chunkSize = end - start + 1;
        const fileStream = fs.createReadStream(fullFilePath, { start, end });

        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize,
          "Content-Type": "audio/mpeg",
        });

        fileStream.pipe(res);
      } else {
        // No range request, send entire file
        res.writeHead(200, {
          "Content-Length": fileSize,
          "Content-Type": "audio/mpeg",
          "Accept-Ranges": "bytes",
        });

        const fileStream = fs.createReadStream(fullFilePath);
        fileStream.pipe(res);
      }
    } catch (error: any) {
      if (error instanceof AppError) {
        next(error);
      } else {
        logger.error(
          `Failed to stream mantra ${req.params.id}: ${error.message}`,
        );
        next(
          new AppError(
            ErrorCodes.INTERNAL_ERROR,
            "Failed to stream mantra",
            500,
            error.message,
          ),
        );
      }
    }
  },
);

// GET /mantras/all - Retrieve mantras with optional authentication
router.get(
  "/all",
  optionalAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let mantras: any[];

      if (req.user) {
        // Authenticated user - get public mantras + user's private mantras
        const userMantras = await ContractUsersMantras.findAll({
          where: {
            userId: req.user.userId,
          },
        });

        const userMantraIds = userMantras.map(
          (contract) => contract.get("mantraId") as number,
        );

        // Get all public mantras with ownership info
        const publicMantras = await Mantra.findAll({
          where: {
            visibility: { [Op.ne]: "private" },
          },
          include: [
            {
              model: ContractUsersMantras,
              as: "contractUsersMantras",
              required: false,
              attributes: ["userId"],
            },
          ],
        });

        // Get user's private mantras with ownership info
        const userPrivateMantras = await Mantra.findAll({
          where: {
            id: { [Op.in]: userMantraIds },
            visibility: "private",
          },
          include: [
            {
              model: ContractUsersMantras,
              as: "contractUsersMantras",
              required: false,
              attributes: ["userId"],
            },
          ],
        });

        // Combine and deduplicate
        const allMantras = [...publicMantras, ...userPrivateMantras];
        const uniqueMantraIds = new Set<number>();
        mantras = allMantras.filter((mantra) => {
          const id = mantra.get("id") as number;
          if (uniqueMantraIds.has(id)) {
            return false;
          }
          uniqueMantraIds.add(id);
          return true;
        });
      } else {
        // Anonymous user - get only public mantras with ownership info
        mantras = await Mantra.findAll({
          where: {
            visibility: { [Op.ne]: "private" },
          },
          include: [
            {
              model: ContractUsersMantras,
              as: "contractUsersMantras",
              required: false,
              attributes: ["userId"],
            },
          ],
        });
      }

      const mantrasWithListens = mantras.map((mantra) => {
        const plainMantra = mantra.get({ plain: true }) as {
          listenCount?: number | null;
          contractUsersMantras?: Array<{ userId: number }>;
        };

        // Extract ownerUserId from contractUsersMantras relationship
        let ownerUserId: number | string = "missing";
        if (
          plainMantra.contractUsersMantras &&
          plainMantra.contractUsersMantras.length > 0
        ) {
          ownerUserId = plainMantra.contractUsersMantras[0].userId;
        }

        // Remove the contractUsersMantras array from response
        const { contractUsersMantras: _, ...mantraWithoutContract } =
          plainMantra;

        return {
          ...mantraWithoutContract,
          listenCount: plainMantra.listenCount ?? 0,
          ownerUserId,
        };
      });

      logger.info(
        `Mantras retrieved${req.user ? ` for user ${req.user.userId}` : " anonymously"}: ${mantrasWithListens.length} mantras`,
      );

      res.status(200).json({
        mantrasArray: mantrasWithListens,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        next(error);
      } else {
        logger.error(`Failed to retrieve mantras: ${error.message}`);
        next(
          new AppError(
            ErrorCodes.INTERNAL_ERROR,
            "Failed to retrieve mantras",
            500,
            error.message,
          ),
        );
      }
    }
  },
);

// Apply authentication middleware to all routes below this point
router.use(authMiddleware);

// POST /mantras/favorite/:mantraId/:trueOrFalse
router.post(
  "/favorite/:mantraId/:trueOrFalse",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const mantraId = parseInt(req.params.mantraId, 10);
      const trueOrFalse = req.params.trueOrFalse;

      // Validate mantraId
      if (isNaN(mantraId)) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          "Invalid mantra ID",
          400,
        );
      }

      // Validate trueOrFalse parameter
      if (trueOrFalse !== "true" && trueOrFalse !== "false") {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          "trueOrFalse parameter must be 'true' or 'false'",
          400,
        );
      }

      const favoriteValue = trueOrFalse === "true";

      // Verify mantra exists
      const mantra = await Mantra.findByPk(mantraId);
      if (!mantra) {
        throw new AppError(
          ErrorCodes.MANTRA_NOT_FOUND,
          "Mantra not found",
          404,
        );
      }

      const userId = req.user!.userId;

      // Find or create ContractUserMantraListen record
      const [listenRecord, created] =
        await ContractUserMantraListen.findOrCreate({
          where: {
            userId,
            mantraId,
          },
          defaults: {
            userId,
            mantraId,
            listenCount: 0,
            favorite: favoriteValue,
          },
        });

      // If record already existed, update the favorite field
      if (!created) {
        await listenRecord.update({
          favorite: favoriteValue,
        });
      }

      logger.info(
        `User ${userId} ${favoriteValue ? "favorited" : "unfavorited"} mantra ${mantraId}`,
      );

      res.status(200).json({
        message: `Mantra ${favoriteValue ? "favorited" : "unfavorited"} successfully`,
        mantraId,
        favorite: favoriteValue,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        next(error);
      } else {
        logger.error(
          `Failed to update favorite for mantra ${req.params.mantraId}: ${error.message}`,
        );
        next(
          new AppError(
            ErrorCodes.INTERNAL_ERROR,
            "Failed to update favorite status",
            500,
            error.message,
          ),
        );
      }
    }
  },
);

// POST /mantras/create
router.post(
  "/create",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { mantraArray } = req.body;

      // Validate mantraArray exists
      if (!mantraArray || !Array.isArray(mantraArray)) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          "mantraArray is required and must be an array",
          400,
        );
      }

      // Log complete request in development mode
      if (process.env.NODE_ENV === "development") {
        logger.info(
          `[DEV] POST /mantras/create request body: ${JSON.stringify(req.body, null, 2)}`,
        );
      }

      // Get queuer URL from environment
      const queuerUrl = process.env.URL_MANTRIFY01QUEUER;
      if (!queuerUrl) {
        throw new AppError(
          ErrorCodes.INTERNAL_ERROR,
          "Queuer URL not configured",
          500,
        );
      }

      logger.info(
        `User ${req.user?.userId} creating mantra with ${mantraArray.length} elements`,
      );

      // Send request to queuer
      const queuerEndpoint = `${queuerUrl}/mantras/new`;
      const response = await fetch(queuerEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: req.user?.userId,
          mantraArray,
        }),
      });

      // Check if response is OK
      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          `Queuer returned error (${response.status}): ${errorText}`,
        );
        throw new AppError(
          ErrorCodes.QUEUER_ERROR,
          "Queuer service returned an error",
          response.status,
          errorText,
        );
      }

      // Parse JSON response
      const responseData = (await response.json()) as QueuerResponse;

      // Validate response structure
      if (!responseData || typeof responseData.success !== "boolean") {
        logger.error(
          `Queuer returned invalid response format: ${JSON.stringify(responseData)}`,
        );
        throw new AppError(
          ErrorCodes.QUEUER_ERROR,
          "Invalid response format from queuer service",
          500,
          JSON.stringify(responseData),
        );
      }

      // Check if queuer reported success
      if (!responseData.success) {
        logger.error(
          `Queuer reported failure: ${responseData.message || "Unknown error"}`,
        );
        throw new AppError(
          ErrorCodes.QUEUER_ERROR,
          responseData.message || "Queuer failed to process mantra",
          500,
          JSON.stringify(responseData),
        );
      }

      logger.info(
        `Mantra successfully created for user ${req.user?.userId}: queueId=${responseData.queueId}, file=${responseData.finalFilePath}`,
      );

      res.status(201).json({
        message: "Mantra created successfully",
        queueId: responseData.queueId,
        filePath: responseData.finalFilePath,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        next(error);
      } else {
        logger.error(
          `Failed to create mantra for user ${req.user?.userId}: ${error.message}`,
        );
        next(
          new AppError(
            ErrorCodes.QUEUER_ERROR,
            "Failed to communicate with queuer service",
            500,
            error.message,
          ),
        );
      }
    }
  },
);

// DELETE /mantras/:id
router.delete(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const mantraId = parseInt(req.params.id, 10);

      // Validate ID
      if (isNaN(mantraId)) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          "Invalid mantra ID",
          400,
        );
      }

      // Verify ownership via ContractUsersMantras
      const ownership = await ContractUsersMantras.findOne({
        where: {
          userId: req.user?.userId,
          mantraId: mantraId,
        },
      });

      if (!ownership) {
        throw new AppError(
          ErrorCodes.UNAUTHORIZED_ACCESS,
          "You do not have permission to delete this mantra",
          403,
        );
      }

      // Find mantra in database
      const mantra = await Mantra.findByPk(mantraId);

      if (!mantra) {
        throw new AppError(
          ErrorCodes.MANTRA_NOT_FOUND,
          "Mantra not found",
          404,
        );
      }

      // Delete MP3 file if it exists
      if (mantra.filename) {
        const filePath = path.join(
          process.env.PATH_MP3_OUTPUT || "",
          mantra.filename as string,
        );

        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            logger.info(`Deleted mantra file: ${filePath}`);
          } catch (error: any) {
            logger.error(
              `Failed to delete mantra file ${filePath}: ${error.message}`,
            );
            throw new AppError(
              ErrorCodes.INTERNAL_ERROR,
              "Failed to delete mantra file",
              500,
              error.message,
            );
          }
        } else {
          logger.warn(
            `Mantra file not found for deletion: ${filePath}. Proceeding with database deletion.`,
          );
        }
      }

      // Delete mantra from database
      await mantra.destroy();

      logger.info(`Mantra ${mantraId} deleted by user ${req.user?.userId}`);

      res.status(200).json({
        message: "Mantra deleted successfully",
        mantraId,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        next(error);
      } else {
        logger.error(
          `Failed to delete mantra ${req.params.id}: ${error.message}`,
        );
        next(
          new AppError(
            ErrorCodes.INTERNAL_ERROR,
            "Failed to delete mantra",
            500,
            error.message,
          ),
        );
      }
    }
  },
);

export default router;

import { Router, Request, Response, NextFunction } from "express";
import { Mantra, ContractUsersMantras } from "mantrify01db";
import { authMiddleware } from "../modules/authMiddleware";
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

// Apply authentication middleware to all routes
router.use(authMiddleware);

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
          400
        );
      }

      // Get queuer URL from environment
      const queuerUrl = process.env.URL_MANTRIFY01QUEUER;
      if (!queuerUrl) {
        throw new AppError(
          ErrorCodes.INTERNAL_ERROR,
          "Queuer URL not configured",
          500
        );
      }

      logger.info(
        `User ${req.user?.userId} creating mantra with ${mantraArray.length} elements`
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
          `Queuer returned error (${response.status}): ${errorText}`
        );
        throw new AppError(
          ErrorCodes.QUEUER_ERROR,
          "Queuer service returned an error",
          response.status,
          errorText
        );
      }

      // Parse JSON response
      const responseData = (await response.json()) as QueuerResponse;

      // Validate response structure
      if (!responseData || typeof responseData.success !== "boolean") {
        logger.error(
          `Queuer returned invalid response format: ${JSON.stringify(responseData)}`
        );
        throw new AppError(
          ErrorCodes.QUEUER_ERROR,
          "Invalid response format from queuer service",
          500,
          JSON.stringify(responseData)
        );
      }

      // Check if queuer reported success
      if (!responseData.success) {
        logger.error(
          `Queuer reported failure: ${responseData.message || "Unknown error"}`
        );
        throw new AppError(
          ErrorCodes.QUEUER_ERROR,
          responseData.message || "Queuer failed to process mantra",
          500,
          JSON.stringify(responseData)
        );
      }

      logger.info(
        `Mantra successfully created for user ${req.user?.userId}: queueId=${responseData.queueId}, file=${responseData.finalFilePath}`
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
          `Failed to create mantra for user ${req.user?.userId}: ${error.message}`
        );
        next(
          new AppError(
            ErrorCodes.QUEUER_ERROR,
            "Failed to communicate with queuer service",
            500,
            error.message
          )
        );
      }
    }
  }
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
          400
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
          403
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

      // Delete MP3 file if it exists
      if (mantra.filename) {
        const filePath = path.join(
          process.env.PATH_MP3_OUTPUT || "",
          mantra.filename as string
        );

        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            logger.info(`Deleted mantra file: ${filePath}`);
          } catch (error: any) {
            logger.error(`Failed to delete mantra file ${filePath}: ${error.message}`);
            throw new AppError(
              ErrorCodes.INTERNAL_ERROR,
              "Failed to delete mantra file",
              500,
              error.message
            );
          }
        } else {
          logger.warn(
            `Mantra file not found for deletion: ${filePath}. Proceeding with database deletion.`
          );
        }
      }

      // Delete mantra from database
      await mantra.destroy();

      logger.info(
        `Mantra ${mantraId} deleted by user ${req.user?.userId}`
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
          `Failed to delete mantra ${req.params.id}: ${error.message}`
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

import dotenv from "dotenv";

// Load environment variables first
dotenv.config();

// Import logger (this will validate required env vars)
import logger from "./modules/logger";

// Import database
import { initModels, sequelize } from "mantrify01db";

// Import Express and middleware
import express, { Request, Response } from "express";
import cors from "cors";

// Import routers
import usersRouter from "./routes/users";
import mantrasRouter from "./routes/mantras";

// Import error handlers
import { errorHandler, notFoundHandler } from "./modules/errorHandler";

// Import startup checks
import { runStartupChecks } from "./modules/onStartUp";

// Async IIFE to allow early exit with proper cleanup
(async () => {
  try {
    logger.info("Starting Mantrify01API...");

    // Validate required environment variables
    const requiredVars = [
      "PORT",
      "JWT_SECRET",
      "PATH_MP3_OUTPUT",
      "PATH_MP3_SOUND_FILES",
      "URL_MANTRIFY01QUEUER",
    ];

    const missingVars = requiredVars.filter((varName) => !process.env[varName]);

    if (missingVars.length > 0) {
      logger.error(
        `Missing required environment variables: ${missingVars.join(", ")}`
      );
      console.error(
        `[FATAL] Missing required environment variables: ${missingVars.join(", ")}`
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
      process.exit(1);
    }

    // Initialize database and run startup checks
    initModels();
    await runStartupChecks();

    // Create Express app
    const app = express();

    // Middleware
    app.use(cors());
    app.use(express.json());

    // Health check endpoint
    app.get("/health", (req: Request, res: Response) => {
      res.status(200).json({ status: "ok", service: "Mantrify01API" });
    });

    // Register routers
    app.use("/users", usersRouter);
    app.use("/mantras", mantrasRouter);

    // 404 handler for unknown routes
    app.use(notFoundHandler);

    // Error handling middleware (must be last)
    app.use(errorHandler);

    // Start server
    const PORT = parseInt(process.env.PORT!, 10);
    app.listen(PORT, () => {
      logger.info(`Mantrify01API server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      logger.info(`Health check available at: http://localhost:${PORT}/health`);
    });
  } catch (error: any) {
    logger.error(`Failed to start server: ${error.message}`);
    console.error(`[FATAL] Failed to start server: ${error.message}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    process.exit(1);
  }
})();

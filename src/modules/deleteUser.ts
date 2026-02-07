import {
  User,
  Mantra,
  ContractUsersMantras,
  ContractUserMantraListen,
  ContractMantrasElevenLabsFiles,
  ElevenLabsFiles,
  Queue,
  sequelize,
} from "mantrify01db";
import { Op } from "sequelize";
import path from "path";
import fs from "fs";
import logger from "./logger";
import { AppError, ErrorCodes } from "./errorHandler";

/**
 * Result returned by deleteUser function
 */
export interface DeleteUserResult {
  userId: number;
  mantrasDeleted: number;
  elevenLabsFilesDeleted: number;
  benevolentUserCreated: boolean;
}

/**
 * ElevenLabs file with full path for deletion
 */
interface ElevenLabsFileToDelete {
  id: number;
  fullPath: string;
}

/**
 * Delete a user and all associated data
 *
 * @param userId - The user ID to delete
 * @param savePublicMantrasAsBenevolentUser - If true, preserve public mantras and convert user to benevolent user
 * @returns DeleteUserResult with counts of deleted items
 */
export async function deleteUser(
  userId: number,
  savePublicMantrasAsBenevolentUser: boolean = false
): Promise<DeleteUserResult> {
  logger.info(`Initiating user deletion for user ID: ${userId}`);

  // Step 1: Validate user exists
  const user = await User.findByPk(userId);
  if (!user) {
    throw new AppError(ErrorCodes.USER_NOT_FOUND, "User not found", 404);
  }

  // Step 2: Get all mantras associated with this user
  const userMantrasContracts = await ContractUsersMantras.findAll({
    where: { userId },
    attributes: ["mantraId"],
  });

  const allUserMantraIds = userMantrasContracts.map(
    (contract) => contract.get("mantraId") as number
  );

  // Step 3: Filter mantras based on savePublicMantrasAsBenevolentUser
  let userDeleteMantraIdsArray: number[] = [];

  if (allUserMantraIds.length > 0) {
    if (savePublicMantrasAsBenevolentUser) {
      // Only delete private mantras
      const privateMantras = await Mantra.findAll({
        where: {
          id: { [Op.in]: allUserMantraIds },
          visibility: "private",
        },
        attributes: ["id"],
      });

      userDeleteMantraIdsArray = privateMantras.map(
        (mantra) => mantra.get("id") as number
      );

      logger.info(
        `Found ${userDeleteMantraIdsArray.length} private mantra(s) to delete for user ${userId}`
      );
    } else {
      // Delete all mantras
      userDeleteMantraIdsArray = allUserMantraIds;
      logger.info(
        `Found ${userDeleteMantraIdsArray.length} mantra(s) to delete for user ${userId}`
      );
    }
  } else {
    logger.info(`User ${userId} has no mantras to delete`);
  }

  // Step 4: Get ElevenLabs file IDs associated with mantras to delete
  let elevenLabsFileIdsArray: number[] = [];

  if (userDeleteMantraIdsArray.length > 0) {
    const elevenLabsContracts = await ContractMantrasElevenLabsFiles.findAll({
      where: {
        mantraId: { [Op.in]: userDeleteMantraIdsArray },
      },
      attributes: ["elevenLabsFileId"],
    });

    // Get unique ElevenLabs file IDs
    const uniqueIds = new Set<number>();
    elevenLabsContracts.forEach((contract) => {
      const fileId = contract.get("elevenLabsFileId") as number;
      uniqueIds.add(fileId);
    });

    elevenLabsFileIdsArray = Array.from(uniqueIds);
    logger.info(
      `Found ${elevenLabsFileIdsArray.length} ElevenLabs file(s) associated with mantras to delete`
    );
  } else {
    logger.info(`No mantras to delete, skipping ElevenLabs file lookup`);
  }

  // Step 5: Get ElevenLabs file paths
  let elevenLabsFilesToDelete: ElevenLabsFileToDelete[] = [];

  if (elevenLabsFileIdsArray.length > 0) {
    const elevenLabsFiles = await ElevenLabsFiles.findAll({
      where: {
        id: { [Op.in]: elevenLabsFileIdsArray },
      },
      attributes: ["id", "filePath", "filename"],
    });

    elevenLabsFilesToDelete = elevenLabsFiles.map((file) => {
      const fileId = file.get("id") as number;
      const filePath = file.get("filePath") as string;
      const filename = file.get("filename") as string;
      const fullPath = path.join(filePath, filename);

      return {
        id: fileId,
        fullPath,
      };
    });

    logger.info(
      `Retrieved file paths for ${elevenLabsFilesToDelete.length} ElevenLabs file(s)`
    );
  } else {
    logger.info(`No ElevenLabs files to retrieve paths for`);
  }

  // PHASE 2: Filesystem Cleanup

  // Step 6: Delete ElevenLabs files from filesystem
  let elevenLabsFilesDeletedCount = 0;

  for (const file of elevenLabsFilesToDelete) {
    try {
      if (fs.existsSync(file.fullPath)) {
        fs.unlinkSync(file.fullPath);
        logger.info(`Deleted ElevenLabs file: ${file.fullPath}`);
        elevenLabsFilesDeletedCount++;
      } else {
        logger.warn(
          `ElevenLabs file not found, skipping: ${file.fullPath}`
        );
      }
    } catch (error: any) {
      logger.error(
        `Failed to delete ElevenLabs file ${file.fullPath}: ${error.message}`
      );
      // Continue processing even if file deletion fails
    }
  }

  logger.info(
    `Deleted ${elevenLabsFilesDeletedCount} of ${elevenLabsFilesToDelete.length} ElevenLabs file(s)`
  );

  // Step 7: Delete mantra MP3 files from filesystem
  let mantraFilesDeletedCount = 0;

  if (userDeleteMantraIdsArray.length > 0) {
    const mantrasToDelete = await Mantra.findAll({
      where: {
        id: { [Op.in]: userDeleteMantraIdsArray },
      },
      attributes: ["id", "filePath", "filename"],
    });

    for (const mantra of mantrasToDelete) {
      try {
        const dbFilePath = mantra.get("filePath") as string | null;
        const filename = mantra.get("filename") as string | null;

        if (filename) {
          let fullPath: string;

          if (dbFilePath) {
            fullPath = path.join(dbFilePath, filename);
          } else {
            const outputPath = process.env.PATH_MP3_OUTPUT;
            if (!outputPath) {
              logger.warn(
                `PATH_MP3_OUTPUT not configured, skipping mantra file deletion for mantra ${mantra.get("id")}`
              );
              continue;
            }
            fullPath = path.join(outputPath, filename);
          }

          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            logger.info(`Deleted mantra file: ${fullPath}`);
            mantraFilesDeletedCount++;
          } else {
            logger.warn(`Mantra file not found, skipping: ${fullPath}`);
          }
        }
      } catch (error: any) {
        logger.error(
          `Failed to delete mantra file for mantra ${mantra.get("id")}: ${error.message}`
        );
        // Continue processing even if file deletion fails
      }
    }

    logger.info(
      `Deleted ${mantraFilesDeletedCount} of ${mantrasToDelete.length} mantra MP3 file(s)`
    );
  }

  // PHASE 3: Database Cleanup

  let mantrasDeletedCount = 0;
  let benevolentUserCreated = false;

  const transaction = await sequelize.transaction();

  try {
    // Step 8: Delete ElevenLabsFiles records
    if (elevenLabsFileIdsArray.length > 0) {
      const deletedElevenLabsCount = await ElevenLabsFiles.destroy({
        where: {
          id: { [Op.in]: elevenLabsFileIdsArray },
        },
        transaction,
      });
      logger.info(
        `Deleted ${deletedElevenLabsCount} ElevenLabs file record(s) from database`
      );
    }

    // Step 9: Delete Mantra records (cascades to contract tables)
    if (userDeleteMantraIdsArray.length > 0) {
      mantrasDeletedCount = await Mantra.destroy({
        where: {
          id: { [Op.in]: userDeleteMantraIdsArray },
        },
        transaction,
      });
      logger.info(
        `Deleted ${mantrasDeletedCount} mantra record(s) from database (cascade deletes contract tables)`
      );
    }

    // Step 10: Delete all user's listen records
    const deletedListenCount = await ContractUserMantraListen.destroy({
      where: {
        userId,
      },
      transaction,
    });
    logger.info(`Deleted ${deletedListenCount} listen record(s) for user ${userId}`);

    // Step 11: Delete queue records
    const deletedQueueCount = await Queue.destroy({
      where: {
        userId,
      },
      transaction,
    });
    logger.info(`Deleted ${deletedQueueCount} queue record(s) for user ${userId}`);

    // Step 12: Handle user record
    if (savePublicMantrasAsBenevolentUser) {
      // Convert to benevolent user
      await User.update(
        {
          email: `BenevolentUser${userId}@go-lightly.love`,
          isAdmin: false,
        },
        {
          where: { id: userId },
          transaction,
        }
      );
      benevolentUserCreated = true;
      logger.info(
        `User ${userId} converted to benevolent user: BenevolentUser${userId}@go-lightly.love`
      );
    } else {
      // Delete user completely
      await User.destroy({
        where: { id: userId },
        transaction,
      });
      logger.info(`Deleted user record for user ${userId}`);
    }

    // Commit transaction
    await transaction.commit();

    logger.info(`User deletion completed successfully for user ID: ${userId}`);

    return {
      userId,
      mantrasDeleted: mantrasDeletedCount,
      elevenLabsFilesDeleted: elevenLabsFilesDeletedCount,
      benevolentUserCreated,
    };
  } catch (error: any) {
    // Rollback transaction on error
    await transaction.rollback();
    logger.error(`Failed to delete user ${userId}: ${error.message}`);
    throw error;
  }
}

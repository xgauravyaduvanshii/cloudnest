import { Request } from 'express';
import multer from 'multer';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Env } from './env.config';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  MAX_FILES,
} from '../constant/multer';
import { BadRequestException } from '../utils/app-error';

const storage = multer.memoryStorage();

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(
      new BadRequestException(`File type ${file.mimetype} not allowed`),
    );
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    files: MAX_FILES,
    fileSize: MAX_FILE_SIZE,
  },
});

export const multiUpload = upload.array('files', MAX_FILES);

/**
 * Resolve (and create) the disk temp directory used by the resumable upload-job
 * pipeline. Defaults to a dedicated folder under the OS temp dir so large files
 * are streamed from disk instead of buffered fully in request memory.
 */
export const getUploadTmpDir = (): string => {
  const dir = Env.UPLOAD_TMP_DIR || path.join(os.tmpdir(), 'cloudnest-uploads');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      cb(null, getUploadTmpDir());
    } catch (error) {
      cb(error as Error, '');
    }
  },
  filename: (req, file, cb) => {
    // Keep the original extension for downstream MIME/type handling; store a random
    // base so temp paths cannot collide or leak the real filename to disk listing.
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${uuidv4()}${ext}`);
  },
});

const diskUpload = multer({
  storage: diskStorage,
  fileFilter,
  limits: {
    files: MAX_FILES,
    fileSize: MAX_FILE_SIZE,
  },
});

export const multiUploadDisk = diskUpload.array('files', MAX_FILES);

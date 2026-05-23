import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middlewares/asyncHander.middleware';
import { UploadSourceEnum } from '../models/file.model';
import { HTTPSTATUS } from '../config/http.config';
import {
  createFolderService,
  createGoogleDriveFolderService,
  createZipStreamFromTokenService,
  deleteFolderService,
  deleteFilesService,
  deleteGoogleDriveItemService,
  downloadFilesService,
  getAllFilesService,
  getFileDetailsService,
  getFilePreviewService,
  getFilesForApiKeyService,
  getFileUrlService,
  getGoogleDriveItemPreviewStreamService,
  listGoogleDriveItemsService,
  moveFilesService,
  moveFolderService,
  moveGoogleDriveItemService,
  uploadFilesService,
} from '../services/files.service';
import {
  createFolderSchema,
  deleteFilesSchema,
  downloadFilesSchema,
  fileIdSchema,
  folderIdSchema,
  googleDriveAccountIdSchema,
  googleDriveFolderSchema,
  googleDriveItemIdSchema,
  googleDriveMoveItemSchema,
  moveFilesSchema,
  moveFolderSchema,
  providerSchema,
} from '../validators/files.validator';

const optionalTextQuery = (value: unknown) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return undefined;
  return trimmed;
};

export const uploadFilesViaWebController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const files = req.files as Express.Multer.File[];
    const uploadedVia = UploadSourceEnum.WEB;
    const folderId = req.body.folderId
      ? folderIdSchema.parse(req.body.folderId)
      : null;
    const provider = req.body.provider
      ? providerSchema.parse(req.body.provider)
      : 'S3';
    const relativePaths = req.body.relativePaths as string | string[] | undefined;
    const storageAccountId = req.body.storageAccountId
      ? googleDriveAccountIdSchema.parse(req.body.storageAccountId)
      : null;
    const providerFolderId = req.body.providerFolderId
      ? z.string().min(1).max(255).parse(req.body.providerFolderId)
      : null;

    const results = await uploadFilesService(userId, files, uploadedVia, {
      folderId,
      provider,
      relativePaths,
      storageAccountId,
      providerFolderId,
    });

    return res.status(HTTPSTATUS.OK).json(results);
  },
);

export const uploadFilesViaApiController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const files = req.files as Express.Multer.File[];
    const uploadedVia = UploadSourceEnum.API;
    const folderId = req.body.folderId
      ? folderIdSchema.parse(req.body.folderId)
      : null;
    const provider = req.body.provider
      ? providerSchema.parse(req.body.provider)
      : 'S3';
    const relativePaths = req.body.relativePaths as string | string[] | undefined;
    const storageAccountId = req.body.storageAccountId
      ? googleDriveAccountIdSchema.parse(req.body.storageAccountId)
      : null;
    const providerFolderId = req.body.providerFolderId
      ? z.string().min(1).max(255).parse(req.body.providerFolderId)
      : null;

    const results = await uploadFilesService(userId, files, uploadedVia, {
      folderId,
      provider,
      relativePaths,
      storageAccountId,
      providerFolderId,
    });

    return res.status(HTTPSTATUS.OK).json(results);
  },
);

export const getApiFilesController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const filter = {
      keyword: req.query.keyword as string | undefined,
      folderId: req.query.folderId
        ? folderIdSchema.parse(req.query.folderId)
        : null,
      provider: req.query.provider
        ? providerSchema.parse(req.query.provider)
        : undefined,
    };
    const pagination = {
      pageSize: parseInt(req.query.pageSize as string) || 20,
      pageNumber: parseInt(req.query.pageNumber as string) || 1,
    };

    const result = await getFilesForApiKeyService(userId, filter, pagination);

    return res.status(HTTPSTATUS.OK).json({
      message: 'Files retrieved successfully',
      ...result,
    });
  },
);

export const getApiFileController = asyncHandler(
  async (req: Request, res: Response) => {
    const fileId = fileIdSchema.parse(req.params.fileId);
    const file = await getFileDetailsService(req.user?._id, fileId);

    return res.status(HTTPSTATUS.OK).json({
      message: 'File retrieved successfully',
      file,
    });
  },
);

export const getApiFilePreviewController = asyncHandler(
  async (req: Request, res: Response) => {
    const fileId = fileIdSchema.parse(req.params.fileId);
    const result = await getFilePreviewService(req.user?._id, fileId);

    return res.status(HTTPSTATUS.OK).json({
      message: result.canPlay
        ? 'Playable media URL created successfully'
        : 'Preview URL created successfully',
      ...result,
    });
  },
);

export const getApiFileDownloadController = asyncHandler(
  async (req: Request, res: Response) => {
    const fileId = fileIdSchema.parse(req.params.fileId);
    const result = await downloadFilesService(req.user?._id, [fileId]);

    return res.status(HTTPSTATUS.OK).json({
      message: 'File download URL created successfully',
      downloadUrl: result?.url,
      isZip: result?.isZip || false,
    });
  },
);

export const deleteApiFileController = asyncHandler(
  async (req: Request, res: Response) => {
    const fileId = fileIdSchema.parse(req.params.fileId);
    const result = await deleteFilesService(req.user?._id, [fileId]);

    return res.status(HTTPSTATUS.OK).json({
      message: 'File deleted successfully',
      ...result,
    });
  },
);

export const getGoogleDriveItemsController = asyncHandler(
  async (req: Request, res: Response) => {
    const accountId = googleDriveAccountIdSchema.parse(req.query.accountId);
    const rawFolderId = optionalTextQuery(req.query.folderId);
    const folderId = rawFolderId
      ? z.string().min(1).max(255).parse(rawFolderId)
      : null;
    const result = await listGoogleDriveItemsService(req.user!, {
      accountId,
      folderId,
      keyword: optionalTextQuery(req.query.keyword),
      pageSize: parseInt(req.query.pageSize as string) || 100,
      pageToken: optionalTextQuery(req.query.pageToken),
    });
    return res.status(HTTPSTATUS.OK).json({
      message: 'Google Drive items retrieved successfully',
      breadcrumbs: [],
      ...result,
    });
  },
);

export const getAllFilesController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const filter = {
      keyword: req.query.keyword as string | undefined,
      folderId: req.query.folderId
        ? folderIdSchema.parse(req.query.folderId)
        : null,
      provider: req.query.provider
        ? providerSchema.parse(req.query.provider)
        : 'S3',
    };
    const pagination = {
      pageSize: parseInt(req.query.pageSize as string) || 20,
      pageNumber: parseInt(req.query.pageNumber as string) || 1,
    };

    const result = await getAllFilesService(userId, filter, pagination);

    return res.status(HTTPSTATUS.OK).json({
      message: 'All files retrueved successfully',
      ...result,
    });
  },
);

export const createFolderController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const body = createFolderSchema.parse(req.body);
    const folder = await createFolderService(userId, body);

    return res.status(HTTPSTATUS.CREATED).json({
      message: 'Folder created successfully',
      folder,
    });
  },
);

export const createGoogleDriveFolderController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = googleDriveFolderSchema.parse(req.body);
    const folder = await createGoogleDriveFolderService(req.user!, body);

    return res.status(HTTPSTATUS.CREATED).json({
      message: 'Google Drive folder created successfully',
      folder,
    });
  },
);

export const moveFilesController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = moveFilesSchema.parse(req.body);
    const result = await moveFilesService(req.user?._id, body);
    return res.status(HTTPSTATUS.OK).json({
      message: 'Files moved successfully',
      ...result,
    });
  },
);

export const moveFolderController = asyncHandler(
  async (req: Request, res: Response) => {
    const folderId = folderIdSchema.parse(req.params.folderId);
    const body = moveFolderSchema.parse(req.body);
    const folder = await moveFolderService(req.user?._id, folderId, body);
    return res.status(HTTPSTATUS.OK).json({
      message: 'Folder moved successfully',
      folder,
    });
  },
);

export const deleteFolderController = asyncHandler(
  async (req: Request, res: Response) => {
    const folderId = folderIdSchema.parse(req.params.folderId);
    const provider = req.query.provider
      ? providerSchema.parse(req.query.provider)
      : 'S3';
    const result = await deleteFolderService(req.user?._id, folderId, provider);
    return res.status(HTTPSTATUS.OK).json({
      message: 'Folder deleted successfully',
      ...result,
    });
  },
);

export const moveGoogleDriveItemController = asyncHandler(
  async (req: Request, res: Response) => {
    const itemId = googleDriveItemIdSchema.parse(req.params.itemId);
    const body = googleDriveMoveItemSchema.parse(req.body);
    const item = await moveGoogleDriveItemService(req.user!, {
      accountId: body.accountId,
      itemId,
      targetFolderId: body.targetFolderId || null,
    });
    return res.status(HTTPSTATUS.OK).json({
      message: 'Google Drive item moved successfully',
      item,
    });
  },
);

export const deleteGoogleDriveItemController = asyncHandler(
  async (req: Request, res: Response) => {
    const itemId = googleDriveItemIdSchema.parse(req.params.itemId);
    const accountId = googleDriveAccountIdSchema.parse(req.query.accountId);
    const result = await deleteGoogleDriveItemService(req.user!, accountId, itemId);
    return res.status(HTTPSTATUS.OK).json({
      message: 'Google Drive item deleted successfully',
      ...result,
    });
  },
);

export const deleteFilesController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const { fileIds } = deleteFilesSchema.parse(req.body);

    const result = await deleteFilesService(userId, fileIds);

    return res.status(HTTPSTATUS.OK).json({
      message: 'Files deleted successfully',
      ...result,
    });
  },
);

export const downloadFilesController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const { fileIds } = downloadFilesSchema.parse(req.body);

    const result = await downloadFilesService(userId, fileIds);

    return res.status(HTTPSTATUS.OK).json({
      message: 'File download URL successfully',
      downloadUrl: result?.url,
      isZip: result?.isZip || false,
    });
  },
);

export const publicGetFileUrlController = asyncHandler(
  async (req: Request, res: Response) => {
    const fileId = fileIdSchema.parse(req.params.fileId);
    const { url, stream, contentType, fileSize } =
      await getFileUrlService(fileId);

    res.removeHeader('Content-Security-Policy');
    res.removeHeader('X-Frame-Options');
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
    });
    if (fileSize) res.set('Content-Length', String(fileSize));

    stream.pipe(res);
    // //302
    // return res.redirect(url);
  },
);

export const publicGetGoogleDriveItemPreviewController = asyncHandler(
  async (req: Request, res: Response) => {
    const accountId = googleDriveAccountIdSchema.parse(req.params.accountId);
    const itemId = googleDriveItemIdSchema.parse(req.params.itemId);
    const token = typeof req.query.token === 'string' ? req.query.token : undefined;
    const { stream, contentType, fileSize } =
      await getGoogleDriveItemPreviewStreamService(accountId, itemId, token);

    res.removeHeader('Content-Security-Policy');
    res.removeHeader('X-Frame-Options');
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=900',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
    });
    if (fileSize) res.set('Content-Length', String(fileSize));

    stream.pipe(res);
  },
);

export const publicDownloadZipController = asyncHandler(
  async (req: Request, res: Response) => {
    const token = req.query.token as string | undefined;
    if (!token) {
      return res.status(HTTPSTATUS.BAD_REQUEST).json({
        message: 'Download token is required',
      });
    }

    const { stream, filename } = await createZipStreamFromTokenService(token);

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, max-age=0, no-store',
      'X-Content-Type-Options': 'nosniff',
    });

    stream.pipe(res);
  },
);

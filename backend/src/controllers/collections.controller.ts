import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/asyncHander.middleware';
import { HTTPSTATUS } from '../config/http.config';
import {
  addFilesToCollectionService,
  createCollectionService,
  deleteCollectionService,
  getCollectionService,
  listCollectionsForFileService,
  listCollectionsService,
  removeFilesFromCollectionService,
  updateCollectionService,
} from '../services/collections.service';
import {
  collectionIdSchema,
  collectionItemsSchema,
  createCollectionSchema,
  updateCollectionSchema,
} from '../validators/collections.validator';
import { fileIdSchema } from '../validators/files.validator';

export const listCollectionsController = asyncHandler(async (req: Request, res: Response) => {
  const collections = await listCollectionsService(req.user?._id);
  return res.status(HTTPSTATUS.OK).json({ collections });
});

export const getCollectionController = asyncHandler(async (req: Request, res: Response) => {
  const collectionId = collectionIdSchema.parse(req.params.collectionId);
  const collection = await getCollectionService(req.user?._id, collectionId);
  return res.status(HTTPSTATUS.OK).json({ collection });
});

export const createCollectionController = asyncHandler(async (req: Request, res: Response) => {
  const payload = createCollectionSchema.parse(req.body);
  const collection = await createCollectionService(req.user?._id, payload);
  return res.status(HTTPSTATUS.CREATED).json({ collection, message: 'Collection created' });
});

export const updateCollectionController = asyncHandler(async (req: Request, res: Response) => {
  const collectionId = collectionIdSchema.parse(req.params.collectionId);
  const payload = updateCollectionSchema.parse(req.body);
  const collection = await updateCollectionService(req.user?._id, collectionId, payload);
  return res.status(HTTPSTATUS.OK).json({ collection, message: 'Collection updated' });
});

export const deleteCollectionController = asyncHandler(async (req: Request, res: Response) => {
  const collectionId = collectionIdSchema.parse(req.params.collectionId);
  await deleteCollectionService(req.user?._id, collectionId);
  return res.status(HTTPSTATUS.OK).json({ message: 'Collection deleted' });
});

export const addFilesToCollectionController = asyncHandler(async (req: Request, res: Response) => {
  const collectionId = collectionIdSchema.parse(req.params.collectionId);
  const { fileIds } = collectionItemsSchema.parse(req.body);
  const collection = await addFilesToCollectionService(req.user?._id, collectionId, fileIds);
  return res.status(HTTPSTATUS.OK).json({ collection, message: 'Files added to collection' });
});

export const removeFilesFromCollectionController = asyncHandler(
  async (req: Request, res: Response) => {
    const collectionId = collectionIdSchema.parse(req.params.collectionId);
    const { fileIds } = collectionItemsSchema.parse(req.body);
    const collection = await removeFilesFromCollectionService(
      req.user?._id,
      collectionId,
      fileIds,
    );
    return res.status(HTTPSTATUS.OK).json({ collection, message: 'Files removed from collection' });
  },
);

export const listCollectionsForFileController = asyncHandler(async (req: Request, res: Response) => {
  const fileId = fileIdSchema.parse(req.params.fileId);
  const collections = await listCollectionsForFileService(req.user?._id, fileId);
  return res.status(HTTPSTATUS.OK).json({ collections });
});

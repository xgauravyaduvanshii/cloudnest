import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/asyncHander.middleware';
import { HTTPSTATUS } from '../config/http.config';
import {
  createApiKeySchema,
  deleteApiKeySchema,
} from '../validators/apikey.validator';
import {
  createApiKeyService,
  deleteApiKeyService,
  getAllApiKeysService,
  revokeApiKeyService,
  rotateApiKeyService,
} from '../services/apikey.service';

export const createApiKeyController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;

    const { name, scopes, expiresInDays } = createApiKeySchema.parse(req.body);

    const { rawKey } = await createApiKeyService(userId, {
      name,
      scopes,
      expiresInDays,
    });

    return res.status(HTTPSTATUS.OK).json({
      message: 'API key created successfully',
      key: rawKey,
    });
  },
);

export const getAllApiKeysController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;

    const pagination = {
      pageSize: parseInt(req.query.pageSize as string) || 10,
      pageNumber: parseInt(req.query.pageNumber as string) || 1,
    };

    const result = await getAllApiKeysService(userId, pagination);

    return res.status(HTTPSTATUS.OK).json({
      message: 'API keys retrieved successfully',
      ...result,
    });
  },
);

export const deleteApiKeyController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;

    const { id } = deleteApiKeySchema.parse(req.params);

    const result = await deleteApiKeyService(userId, id);

    return res.status(HTTPSTATUS.OK).json({
      message: 'API key deleted successfully',
      data: result,
    });
  },
);

export const revokeApiKeyController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const { id } = deleteApiKeySchema.parse(req.params);
    const result = await revokeApiKeyService(userId, id);
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: 'API key revoked successfully', data: result });
  },
);

export const rotateApiKeyController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const { id } = deleteApiKeySchema.parse(req.params);
    const { rawKey } = await rotateApiKeyService(userId, id);
    return res.status(HTTPSTATUS.OK).json({
      message: 'API key rotated successfully',
      key: rawKey,
    });
  },
);

import {
  LoginSchemaType,
  RegisterSchemaType,
} from '../validators/auth.validator';
import UserModel from '../models/user.model';
import { NotFoundException, UnauthorizedException } from '../utils/app-error';
import StorageModel from '../models/storage.model';
import { logger } from '../utils/logger';
import { signJwtToken } from '../utils/jwt';
import { withTransaction } from '../config/database.config';

export const registerService = async (body: RegisterSchemaType) => {
  const { email } = body;

  try {
    await withTransaction(async (client) => {
      const existingUser = await UserModel.findByEmail(email, client);
      if (existingUser) throw new UnauthorizedException('User already exists');

      const newUser = await UserModel.create(
        {
          ...body,
          profilePicture: body.profilePicture || null,
        },
        client,
      );

      await StorageModel.createForUser(newUser._id, client);

      return { user: newUser.omitPassword() };
    });
  } catch (error) {
    logger.error('Error registering user', error);
    throw error;
  }
};

export const loginService = async (body: LoginSchemaType) => {
  const { email, password } = body;
  const user = await UserModel.findByEmail(email);
  if (!user) throw new NotFoundException('Email/Password not found');
  if (user.status === 'DISABLED') {
    throw new UnauthorizedException('User account is disabled');
  }

  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid)
    throw new UnauthorizedException('Email/Password is incorrect');

  const { token, expiresAt } = signJwtToken({
    userId: user.id,
  });

  return {
    user: user.omitPassword(),
    accessToken: token,
    expiresAt,
  };
};

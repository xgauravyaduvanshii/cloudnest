import { PublicUserDocument } from '../models/user.model';

declare global {
  namespace Express {
    interface User extends PublicUserDocument {
      _id?: any;
      password?: any;
    }
    interface Request {
      apiKey?: {
        id: string;
        displayKey: string;
        scopes: string[];
      };
    }
  }
}

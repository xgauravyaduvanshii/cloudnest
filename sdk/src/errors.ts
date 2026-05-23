export enum UploadErrorCode {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  UNAUTHORIZED = "UNAUTHORIZED",
  UPLOAD_FAILED = "UPLOAD_FAILED",
  REQUEST_FAILED = "REQUEST_FAILED",
  INVALID_FILE = "INVALID_FILE",
  NETWORK_ERROR = "NETWORK_ERROR",
}

export class CloudNestError extends Error {
  public statusCode: number;
  public errorCode: UploadErrorCode;

  constructor(message: string, statusCode = 500, errorCode: UploadErrorCode) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends CloudNestError {
  constructor(message = "Validation Error") {
    super(message, 400, UploadErrorCode.VALIDATION_ERROR);
  }
}

export class UnauthorizedError extends CloudNestError {
  constructor(message = "Unauthorized - Invalid API Key") {
    super(message, 401, UploadErrorCode.UNAUTHORIZED);
  }
}

export class UploadError extends CloudNestError {
  constructor(message = "Upload failed") {
    super(message, 500, UploadErrorCode.UPLOAD_FAILED);
  }
}

export class NetworkError extends CloudNestError {
  constructor(message = "Network request failed") {
    super(message, 503, UploadErrorCode.NETWORK_ERROR);
  }
}

export class InvalidFileError extends CloudNestError {
  constructor(message = "Invalid file input") {
    super(message, 400, UploadErrorCode.INVALID_FILE);
  }
}

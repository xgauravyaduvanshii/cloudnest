export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
export const MAX_FILES = 100; // per request
export const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
  'image/gif',

  // Documents
  'application/pdf', // PDF files
  'application/msword', // .doc files
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx files

  // Text files
  'text/plain',
  'text/csv',
  'application/json',
  'text/markdown',

  // Archives
  'application/zip',
  'application/x-zip-compressed',
  'application/x-tar',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx

  // Audio
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/wav',
  'audio/webm',
  'audio/ogg',

  // Video
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
];

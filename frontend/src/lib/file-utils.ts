const MIME_MAP: Record<string, string> = {
  html: 'text/html',
  htm: 'text/html',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
};

export type FileTypeCategory =
  | 'html'
  | 'pdf'
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'image'
  | 'unknown';

const CATEGORY_MAP: Record<string, FileTypeCategory> = {
  html: 'html',
  htm: 'html',
  pdf: 'pdf',
  doc: 'document',
  docx: 'document',
  xls: 'spreadsheet',
  xlsx: 'spreadsheet',
  ppt: 'presentation',
  pptx: 'presentation',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  svg: 'image',
  webp: 'image',
};

export function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

export function getMimeType(fileName: string, fallback?: string): string {
  const ext = getFileExtension(fileName);
  return MIME_MAP[ext] || fallback || 'application/octet-stream';
}

export function getFileTypeCategory(fileName: string): FileTypeCategory {
  const ext = getFileExtension(fileName);
  return CATEGORY_MAP[ext] || 'unknown';
}

/** Whether this file type can be rendered inline (iframe or img tag) */
export function isViewableInline(fileName: string): boolean {
  const cat = getFileTypeCategory(fileName);
  return cat === 'html' || cat === 'pdf' || cat === 'image';
}

/** Whether this file type should be opened in a new tab (all viewable types) */
export function isViewableInNewTab(fileName: string): boolean {
  const cat = getFileTypeCategory(fileName);
  return cat === 'html' || cat === 'pdf' || cat === 'image';
}

/** Whether a download option should be shown (everything except HTML) */
export function isDownloadable(fileName: string): boolean {
  const cat = getFileTypeCategory(fileName);
  return cat !== 'html';
}

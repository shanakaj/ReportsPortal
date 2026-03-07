import { useState, useCallback } from 'react';
import { Upload, FileText, Image, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getReportUploadUrl, getAssetUploadUrl, uploadReportFile } from '@/services/reports';
import { cn } from '@/lib/utils';

interface ReportUploadProps {
  spaceId: string;
  onUploaded: () => void;
  disabled?: boolean;
}

const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp'];
const MAX_SIZE = 50 * 1024 * 1024; // 50MB per file

function getMimeType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp',
    html: 'text/html', htm: 'text/html',
  };
  return mimeMap[ext || ''] || 'application/octet-stream';
}

function isHtmlFile(file: File): boolean {
  return file.name.endsWith('.html') || file.name.endsWith('.htm');
}

function isImageFile(file: File): boolean {
  const mime = getMimeType(file);
  return ACCEPTED_IMAGE_TYPES.includes(mime);
}

export function ReportUpload({ spaceId, onUploaded, disabled }: ReportUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [htmlFile, setHtmlFile] = useState<File | null>(null);
  const [assetFiles, setAssetFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    setError(null);

    for (const f of fileArray) {
      if (f.size > MAX_SIZE) {
        setError(`${f.name} exceeds 50MB limit`);
        return;
      }
    }

    const html = fileArray.find(isHtmlFile);
    const images = fileArray.filter(isImageFile);
    const unrecognized = fileArray.filter(f => !isHtmlFile(f) && !isImageFile(f));

    if (unrecognized.length > 0) {
      setError(`Unsupported file type: ${unrecognized[0].name}. Use HTML and image files.`);
      return;
    }

    if (html) {
      setHtmlFile(html);
    }
    if (images.length > 0) {
      setAssetFiles(prev => {
        const existingNames = new Set(prev.map(f => f.name));
        const newImages = images.filter(f => !existingNames.has(f.name));
        return [...prev, ...newImages];
      });
    }

    if (!html && images.length === 0) {
      setError('Please select an HTML report file, optionally with image files.');
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const removeAsset = (index: number) => {
    setAssetFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setHtmlFile(null);
    setAssetFiles([]);
    setError(null);
  };

  const handleUpload = async () => {
    if (!htmlFile) return;
    setIsUploading(true);
    setError(null);
    setProgress(0);

    try {
      const totalFiles = 1 + assetFiles.length;
      let filesUploaded = 0;

      // 1. Upload the HTML report
      setUploadStatus(`Uploading ${htmlFile.name}...`);
      const { uploadUrl, reportId } = await getReportUploadUrl(spaceId, htmlFile.name, 'text/html');
      await uploadReportFile(uploadUrl, htmlFile, (p) => {
        setProgress(Math.round((filesUploaded * 100 + p) / totalFiles));
      });
      filesUploaded++;

      // 2. Upload each asset file
      for (const asset of assetFiles) {
        setUploadStatus(`Uploading ${asset.name}...`);
        const { uploadUrl: assetUrl } = await getAssetUploadUrl(
          spaceId, reportId, asset.name, getMimeType(asset),
        );
        await uploadReportFile(assetUrl, asset, (p) => {
          setProgress(Math.round((filesUploaded * 100 + p) / totalFiles));
        });
        filesUploaded++;
      }

      setProgress(100);
      setUploadStatus('');
      clearAll();
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      setUploadStatus('');
    }
  };

  const hasFiles = htmlFile || assetFiles.length > 0;

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'relative rounded-lg border-2 border-dashed p-8 text-center transition-colors',
          isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
          disabled && 'opacity-50 pointer-events-none',
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {hasFiles ? (
          <div className="space-y-3">
            {htmlFile && (
              <div className="flex items-center justify-center gap-3">
                <FileText className="h-6 w-6 text-primary" />
                <div className="text-left">
                  <p className="text-sm font-medium">{htmlFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(htmlFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHtmlFile(null)}
                  className="ml-2 rounded-md p-1 hover:bg-accent"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {assetFiles.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {assetFiles.length} image{assetFiles.length > 1 ? 's' : ''}
                </p>
                {assetFiles.map((asset, index) => (
                  <div key={asset.name} className="flex items-center justify-center gap-2 text-xs">
                    <Image className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{asset.name}</span>
                    <span className="text-muted-foreground/60">
                      ({(asset.size / 1024).toFixed(0)} KB)
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAsset(index)}
                      className="rounded-md p-0.5 hover:bg-accent"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {!htmlFile && (
              <p className="text-xs text-amber-600">
                Add an HTML report file to upload
              </p>
            )}
            <label className="cursor-pointer text-xs text-primary hover:underline">
              Add more files
              <input
                type="file"
                accept=".html,.htm,.png,.jpg,.jpeg,.gif,.svg,.webp"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) handleFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Drag and drop report files here, or{' '}
              <label className="cursor-pointer text-primary hover:underline">
                browse
                <input
                  type="file"
                  accept=".html,.htm,.png,.jpg,.jpeg,.gif,.svg,.webp"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) handleFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
            </p>
            <p className="text-xs text-muted-foreground">
              HTML report with optional images (PNG, JPG, SVG). Max 50MB per file.
            </p>
          </div>
        )}
      </div>

      {isUploading && (
        <div className="space-y-1">
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {uploadStatus || `${progress}%`}
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {htmlFile && !isUploading && (
        <Button onClick={handleUpload} disabled={disabled} className="w-full">
          Upload Report{assetFiles.length > 0 ? ` + ${assetFiles.length} image${assetFiles.length > 1 ? 's' : ''}` : ''}
        </Button>
      )}
    </div>
  );
}

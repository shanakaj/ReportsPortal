import { useState, useCallback } from 'react';
import { Upload, FileText, Image, X, FileSpreadsheet, File as FileIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getReportUploadUrl, getAssetUploadUrl, uploadReportFile } from '@/services/reports';
import { cn } from '@/lib/utils';
import { getFileExtension, getMimeType, getFileTypeCategory } from '@/lib/file-utils';

interface ReportUploadProps {
  spaceId: string;
  onUploaded: () => void;
  disabled?: boolean;
}

const MAX_SIZE = 50 * 1024 * 1024; // 50MB per file

const ACCEPTED_EXTENSIONS =
  '.html,.htm,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.svg,.webp';

function isReportFile(file: File): boolean {
  const cat = getFileTypeCategory(file.name);
  return cat === 'html' || cat === 'pdf' || cat === 'document' || cat === 'spreadsheet' || cat === 'presentation';
}

function isImageFile(file: File): boolean {
  return getFileTypeCategory(file.name) === 'image';
}

function isHtmlFile(file: File): boolean {
  const ext = getFileExtension(file.name);
  return ext === 'html' || ext === 'htm';
}

function FileTypeIcon({ fileName, className }: { fileName: string; className?: string }) {
  const cat = getFileTypeCategory(fileName);
  switch (cat) {
    case 'pdf':
      return <FileText className={cn('text-red-500', className)} />;
    case 'spreadsheet':
      return <FileSpreadsheet className={cn('text-green-600', className)} />;
    case 'presentation':
      return <FileIcon className={cn('text-orange-500', className)} />;
    case 'document':
      return <FileText className={cn('text-blue-500', className)} />;
    case 'image':
      return <Image className={cn('text-purple-500', className)} />;
    default:
      return <FileText className={cn('text-primary', className)} />;
  }
}

export function ReportUpload({ spaceId, onUploaded, disabled }: ReportUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [reportFile, setReportFile] = useState<File | null>(null);
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

    const report = fileArray.find(isReportFile);
    const images = fileArray.filter(isImageFile);
    const unrecognized = fileArray.filter(f => !isReportFile(f) && !isImageFile(f));

    if (unrecognized.length > 0) {
      setError(
        `Unsupported file type: ${unrecognized[0].name}. ` +
        'Supported: HTML, PDF, Word, Excel, PowerPoint, and image files.',
      );
      return;
    }

    if (report) {
      setReportFile(report);
      // Only allow asset images alongside HTML reports
      if (!isHtmlFile(report)) {
        setAssetFiles([]);
      }
    }

    // Only add asset images if the main report is HTML
    if (images.length > 0) {
      const currentReport = report || reportFile;
      if (currentReport && isHtmlFile(currentReport)) {
        setAssetFiles(prev => {
          const existingNames = new Set(prev.map(f => f.name));
          const newImages = images.filter(f => !existingNames.has(f.name));
          return [...prev, ...newImages];
        });
      } else if (!report && !reportFile) {
        // No report file yet — just images dropped alone
        setError('Please select a report file first. Images can only be added alongside HTML reports.');
      }
    }

    if (!report && images.length === 0) {
      setError('Please select a report file (HTML, PDF, Word, Excel, or PowerPoint).');
    }
  }, [reportFile]);

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
    setReportFile(null);
    setAssetFiles([]);
    setError(null);
  };

  const handleUpload = async () => {
    if (!reportFile) return;
    setIsUploading(true);
    setError(null);
    setProgress(0);

    try {
      const totalFiles = 1 + assetFiles.length;
      let filesUploaded = 0;

      // 1. Upload the main report file
      setUploadStatus(`Uploading ${reportFile.name}...`);
      const contentType = getMimeType(reportFile.name, reportFile.type);
      const { uploadUrl, reportId } = await getReportUploadUrl(spaceId, reportFile.name, contentType);
      await uploadReportFile(uploadUrl, reportFile, (p) => {
        setProgress(Math.round((filesUploaded * 100 + p) / totalFiles));
      });
      filesUploaded++;

      // 2. Upload each asset file (only for HTML reports)
      for (const asset of assetFiles) {
        setUploadStatus(`Uploading ${asset.name}...`);
        const assetType = getMimeType(asset.name, asset.type);
        const { uploadUrl: assetUrl } = await getAssetUploadUrl(
          spaceId, reportId, asset.name, assetType,
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

  const hasFiles = reportFile || assetFiles.length > 0;
  const showAssetHint = reportFile && isHtmlFile(reportFile);

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
            {reportFile && (
              <div className="flex items-center justify-center gap-3">
                <FileTypeIcon fileName={reportFile.name} className="h-6 w-6" />
                <div className="text-left">
                  <p className="text-sm font-medium">{reportFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(reportFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setReportFile(null); setAssetFiles([]); }}
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
            {showAssetHint && (
              <label className="cursor-pointer text-xs text-primary hover:underline">
                Add image files
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.gif,.svg,.webp"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) handleFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
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
                  accept={ACCEPTED_EXTENSIONS}
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
              HTML, PDF, Word, Excel, PowerPoint. HTML reports can include images. Max 50MB per file.
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

      {reportFile && !isUploading && (
        <Button onClick={handleUpload} disabled={disabled} className="w-full">
          Upload Report{assetFiles.length > 0 ? ` + ${assetFiles.length} image${assetFiles.length > 1 ? 's' : ''}` : ''}
        </Button>
      )}
    </div>
  );
}

import { useState, useCallback } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getReportUploadUrl, uploadReportFile } from '@/services/reports';
import { cn } from '@/lib/utils';

interface ReportUploadProps {
  spaceId: string;
  onUploaded: () => void;
  disabled?: boolean;
}

export function ReportUpload({ spaceId, onUploaded, disabled }: ReportUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MAX_SIZE = 50 * 1024 * 1024; // 50MB

  const validateFile = (f: File): string | null => {
    if (!f.name.endsWith('.html') && !f.name.endsWith('.htm')) {
      return 'Only HTML files are allowed';
    }
    if (f.size > MAX_SIZE) {
      return 'File size exceeds 50MB limit';
    }
    return null;
  };

  const handleFile = useCallback((f: File) => {
    const validationError = validateFile(f);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setFile(f);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFile(droppedFile);
    },
    [handleFile],
  );

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    setProgress(0);

    try {
      const { uploadUrl } = await getReportUploadUrl(spaceId, file.name, 'text/html');
      await uploadReportFile(uploadUrl, file, setProgress);
      setFile(null);
      setProgress(0);
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

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
        {file ? (
          <div className="flex items-center justify-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div className="text-left">
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="ml-2 rounded-md p-1 hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Drag and drop an HTML report here, or{' '}
              <label className="cursor-pointer text-primary hover:underline">
                browse
                <input
                  type="file"
                  accept=".html,.htm"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </label>
            </p>
            <p className="text-xs text-muted-foreground">
              Max file size: 50MB. HTML files only.
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
          <p className="text-xs text-muted-foreground text-center">{progress}%</p>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {file && !isUploading && (
        <Button onClick={handleUpload} disabled={disabled} className="w-full">
          Upload Report
        </Button>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Paperclip, X, FileText, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAttachmentUploadUrl } from '@/services/feedback';
import axios from 'axios';

interface AttachmentUploadProps {
  threadId: string;
  onUploaded: (attachmentId: string, fileName: string) => void;
  disabled?: boolean;
}

interface PendingFile {
  file: File;
  progress: number;
  error?: string;
}

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'application/pdf'];

export function AttachmentUpload({ threadId, onUploaded, disabled }: AttachmentUploadProps) {
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setPendingFiles((prev) => [
          ...prev,
          { file, progress: 0, error: 'Only images (PNG, JPEG, GIF) and PDF files are allowed' },
        ]);
        continue;
      }

      if (file.size > MAX_SIZE) {
        setPendingFiles((prev) => [
          ...prev,
          { file, progress: 0, error: 'File size exceeds 10MB limit' },
        ]);
        continue;
      }

      const pending: PendingFile = { file, progress: 0 };
      setPendingFiles((prev) => [...prev, pending]);

      try {
        const { uploadUrl, attachmentId } = await getAttachmentUploadUrl(
          threadId,
          file.name,
          file.type,
        );

        await axios.put(uploadUrl, file, {
          headers: { 'Content-Type': file.type },
          onUploadProgress: (event) => {
            if (event.total) {
              const progress = Math.round((event.loaded * 100) / event.total);
              setPendingFiles((prev) =>
                prev.map((pf) =>
                  pf.file === file ? { ...pf, progress } : pf,
                ),
              );
            }
          },
        });

        onUploaded(attachmentId, file.name);
        setPendingFiles((prev) => prev.filter((pf) => pf.file !== file));
      } catch {
        setPendingFiles((prev) =>
          prev.map((pf) =>
            pf.file === file ? { ...pf, error: 'Upload failed' } : pf,
          ),
        );
      }
    }

    e.target.value = '';
  };

  const removeFile = (file: File) => {
    setPendingFiles((prev) => prev.filter((pf) => pf.file !== file));
  };

  return (
    <div className="space-y-2">
      <label>
        <Button variant="outline" size="sm" disabled={disabled} asChild>
          <span className="cursor-pointer">
            <Paperclip className="mr-1 h-3 w-3" />
            Attach File
          </span>
        </Button>
        <input
          type="file"
          className="hidden"
          accept=".png,.jpg,.jpeg,.gif,.pdf"
          multiple
          onChange={handleFileSelect}
          disabled={disabled}
        />
      </label>

      {pendingFiles.length > 0 && (
        <div className="space-y-1">
          {pendingFiles.map((pf, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs"
            >
              {pf.file.type.startsWith('image/') ? (
                <Image className="h-4 w-4 shrink-0" />
              ) : (
                <FileText className="h-4 w-4 shrink-0" />
              )}
              <span className="flex-1 truncate">{pf.file.name}</span>
              {pf.error ? (
                <span className="text-destructive">{pf.error}</span>
              ) : (
                <span className="text-muted-foreground">{pf.progress}%</span>
              )}
              <button type="button" onClick={() => removeFile(pf.file)}>
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

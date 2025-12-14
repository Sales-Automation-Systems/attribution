'use client';

import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowUpCircle, Loader2, Paperclip, X, FileText, Image, File } from 'lucide-react';
import { DefinitionTooltip } from '@/components/ui/definition-tooltip';

interface AttributeModalProps {
  isOpen: boolean;
  onClose: () => void;
  domainId: string;
  domainName: string;
  slug: string;
  uuid: string;
  currentStatus: 'outside_window' | 'unattributed';
  onSuccess?: () => void;
}

interface AttachedFile {
  name: string;
  size: number;
  type: string;
}

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return <Image className="h-4 w-4" />;
  if (type.includes('pdf') || type.includes('document') || type.includes('text')) return <FileText className="h-4 w-4" />;
  return <File className="h-4 w-4" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttributeModal({
  isOpen,
  onClose,
  domainId,
  domainName,
  slug,
  uuid,
  currentStatus,
  onSuccess,
}: AttributeModalProps) {
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/clients/${slug}/${uuid}/domains/${domainId}/attribute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            notes: notes.trim() || null,
            // Attachments would be uploaded separately in a full implementation
            attachmentCount: attachments.length,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to attribute domain');
      }

      // Success
      onSuccess?.();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setNotes('');
    setError(null);
    setAttachments([]);
    onClose();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newAttachments: AttachedFile[] = Array.from(files).map(file => ({
        name: file.name,
        size: file.size,
        type: file.type,
      }));
      setAttachments(prev => [...prev, ...newAttachments]);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const statusLabel = currentStatus === 'outside_window' ? 'Outside Window' : 'Unattributed';

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5 text-blue-500" />
            <DefinitionTooltip term="manualAttribution">Attribute This Account</DefinitionTooltip>
          </DialogTitle>
          <DialogDescription>
            Add <strong>{domainName}</strong> to your billable attribution.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Status */}
          <div className="p-4 rounded-lg bg-muted/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Current Status</span>
              <span className="font-medium">{statusLabel}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">New Status</span>
              <span className="font-medium text-blue-600">Client-Attributed</span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about why you're attributing this account..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <Label>Attachments (optional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx,.xls"
            />
            
            {/* Attachment List */}
            {attachments.length > 0 && (
              <div className="space-y-2 mb-2">
                {attachments.map((file, index) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {getFileIcon(file.type)}
                      <span className="truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        ({formatFileSize(file.size)})
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 shrink-0"
                      onClick={() => removeAttachment(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Upload Button */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-4 w-4 mr-2" />
              Attach Files
            </Button>
            <p className="text-xs text-muted-foreground">
              Attach screenshots, documents, or CSVs to support this attribution.
            </p>
          </div>

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Attributing...
              </>
            ) : (
              <>
                <ArrowUpCircle className="h-4 w-4 mr-2" />
                Confirm Attribution
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

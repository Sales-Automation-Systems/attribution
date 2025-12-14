'use client';

import { useState, useRef } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowUpCircle,
  Loader2,
  Paperclip,
  X,
  FileText,
  Image,
  File,
  Clock,
  CircleSlash,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

interface AttributeSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  domain: {
    id: string;
    domain: string;
    status: string;
    is_within_window: boolean;
    match_type: string | null;
  } | null;
  slug: string;
  uuid: string;
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

export function AttributeSidePanel({
  isOpen,
  onClose,
  domain,
  slug,
  uuid,
  onSuccess,
}: AttributeSidePanelProps) {
  const [submittedBy, setSubmittedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine current status label
  const getCurrentStatus = () => {
    if (!domain) return 'Unknown';
    if (domain.status === 'OUTSIDE_WINDOW' || 
        (!domain.is_within_window && domain.match_type !== 'NO_MATCH' && domain.match_type !== null)) {
      return 'outside_window';
    }
    return 'unattributed';
  };

  const currentStatus = getCurrentStatus();
  const statusLabel = currentStatus === 'outside_window' ? 'Outside Window' : 'Unattributed';

  const handleSubmit = async () => {
    if (!domain) return;
    
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/clients/${slug}/${uuid}/domains/${domain.id}/attribute`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            submittedBy: submittedBy.trim() || null,
            notes: notes.trim() || null,
            attachmentCount: attachments.length,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to attribute domain');
      }

      toast.success('Account attributed successfully');
      handleClose();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSubmittedBy('');
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  if (!domain) return null;

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4 border-b">
          <div className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5 text-blue-500" />
            <SheetTitle>Manual Attribution</SheetTitle>
          </div>
          <SheetDescription className="flex items-center gap-2">
            <span className="font-medium">{domain.domain}</span>
            <Badge variant="outline" className={
              currentStatus === 'outside_window'
                ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
                : 'bg-gray-500/10 text-gray-600 dark:text-gray-400'
            }>
              {currentStatus === 'outside_window' ? (
                <Clock className="h-3 w-3 mr-1" />
              ) : (
                <CircleSlash className="h-3 w-3 mr-1" />
              )}
              {statusLabel}
            </Badge>
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {/* Status Change Info */}
            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Current Status</span>
                <Badge variant="outline" className={
                  currentStatus === 'outside_window'
                    ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
                    : 'bg-gray-500/10 text-gray-600 dark:text-gray-400'
                }>
                  {statusLabel}
                </Badge>
              </div>
              <div className="flex items-center justify-center">
                <div className="h-px flex-1 bg-border" />
                <span className="px-2 text-xs text-muted-foreground">will become</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">New Status</span>
                <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Manually Attributed
                </Badge>
              </div>
            </div>

            {/* Submitted By */}
            <div className="space-y-2">
              <Label htmlFor="panel-submitted-by">Your Name/Email</Label>
              <Input
                id="panel-submitted-by"
                placeholder="e.g. john@company.com"
                value={submittedBy}
                onChange={(e) => setSubmittedBy(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="panel-notes">Notes (optional)</Label>
              <Textarea
                id="panel-notes"
                placeholder="Add any notes about why you're attributing this account..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[100px]"
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

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700"
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
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}


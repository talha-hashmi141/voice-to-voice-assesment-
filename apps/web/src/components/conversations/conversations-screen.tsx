'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useConversations } from '@/features/conversations';
import { conversationsApi } from '@/lib/api';
import { ConversationTable } from './conversation-table';

export function ConversationsScreen() {
  const conversations = useConversations();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await conversationsApi.delete(pendingDelete);
      toast.success('Conversation deleted');
      conversations.reload();
    } catch {
      toast.error('Could not delete the conversation');
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="Conversations" description="Every voice session with its transcript, cited sources and agent trace." />
      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
        {conversations.error ? <p className="text-sm text-state-error">{conversations.error}</p> : null}
        <ConversationTable conversations={conversations.data?.conversations ?? []} loading={conversations.loading} onDelete={setPendingDelete} />
      </div>
      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this conversation?</DialogTitle>
            <DialogDescription>The transcript and its traces will be removed permanently.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

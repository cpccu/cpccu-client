'use client';
import { useState } from 'react';
import { Search, Mail, MailOpen, Reply, Archive, Trash2, Clock, ChevronRight, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { demoContactMessages } from '@/lib/demo-data';
import { showSuccessAlert, showConfirmAlert } from '@/lib/alerts';
import { formatDate } from '@/lib/format-date';
import useAdminContent from '@/hooks/use-admin-content';
const statusConfig = {
    unread: { label: 'Unread', variant: 'default', icon: <Mail className="size-3"/> },
    read: { label: 'Read', variant: 'secondary', icon: <MailOpen className="size-3"/> },
    replied: { label: 'Replied', variant: 'outline', icon: <Reply className="size-3"/> },
    archived: { label: 'Archived', variant: 'destructive', icon: <Archive className="size-3"/> },
};
export function MessagesContent() {
    const { items: messages, setItems: setMessages, updateItem, deleteItem } = useAdminContent('messages', demoContactMessages);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [replyDialogOpen, setReplyDialogOpen] = useState(false);
    const [replyContent, setReplyContent] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const filteredMessages = messages.filter((msg) => {
        const matchesSearch = msg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            msg.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            msg.subject.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesTab = activeTab === 'all' || msg.status === activeTab;
        return matchesSearch && matchesTab;
    });
    const unreadCount = messages.filter((m) => m.status === 'unread').length;
    const handleSelectMessage = async (msg) => {
        setSelectedMessage(msg);
        // Mark as read when opened
        if (msg.status === 'unread') {
            await updateItem(msg.id, { status: 'read' });
        }
    };
    const handleMarkAsRead = async (id) => {
        await updateItem(id, { status: 'read' });
        showSuccessAlert('Done', 'Message marked as read');
    };
    const handleReply = async () => {
        if (!selectedMessage || !replyContent.trim())
            return;
        await updateItem(selectedMessage.id, { status: 'replied', repliedAt: new Date().toISOString(), reply: replyContent });
        showSuccessAlert('Sent!', 'Reply sent successfully');
        setReplyDialogOpen(false);
        setReplyContent('');
    };
    const handleArchive = async (id) => {
        const result = await showConfirmAlert('Archive this message?', 'You can still find it in the archived tab.');
        if (result.isConfirmed) {
            await updateItem(id, { status: 'archived' });
            if (selectedMessage?.id === id)
                setSelectedMessage(null);
            showSuccessAlert('Archived', 'Message archived');
        }
    };
    const handleDelete = async (id) => {
        const result = await showConfirmAlert('Delete this message?', 'This action cannot be undone.');
        if (result.isConfirmed) {
            await deleteItem(id);
            if (selectedMessage?.id === id)
                setSelectedMessage(null);
            showSuccessAlert('Deleted', 'Message deleted');
        }
    };
    return (<div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-balance">Contact Messages</h1>
        <p className="text-muted-foreground">
          Manage inquiries and messages from the contact form.{' '}
          {unreadCount > 0 && <span className="text-primary font-medium">{unreadCount} unread</span>}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {['unread', 'read', 'replied', 'archived'].map((status) => {
            const config = statusConfig[status];
            const count = messages.filter((m) => m.status === status).length;
            return (<Card key={status} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setActiveTab(status)}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {config.icon}
                    <span className="text-sm font-medium capitalize">{status}</span>
                  </div>
                  <span className="text-2xl font-bold">{count}</span>
                </div>
              </CardContent>
            </Card>);
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Message List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground"/>
                <Input placeholder="Search messages..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9"/>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v)}>
              <TabsList className="mx-4 mb-2 grid grid-cols-5">
                <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                <TabsTrigger value="unread" className="text-xs">New</TabsTrigger>
                <TabsTrigger value="read" className="text-xs">Read</TabsTrigger>
                <TabsTrigger value="replied" className="text-xs">Replied</TabsTrigger>
                <TabsTrigger value="archived" className="text-xs">Archived</TabsTrigger>
              </TabsList>
              <TabsContent value={activeTab} className="mt-0">
                <div className="max-h-[500px] overflow-y-auto">
                  {filteredMessages.length === 0 ? (<div className="p-8 text-center text-muted-foreground">
                      No messages found
                    </div>) : (filteredMessages.map((msg) => (<div key={msg.id} className={`flex cursor-pointer items-start gap-3 border-b p-4 transition-colors hover:bg-muted/50 ${selectedMessage?.id === msg.id ? 'bg-muted' : ''} ${msg.status === 'unread' ? 'bg-primary/5' : ''}`} onClick={() => handleSelectMessage(msg)}>
                        <div className={`mt-1 size-2 shrink-0 rounded-full ${msg.status === 'unread' ? 'bg-primary' : 'bg-transparent'}`}/>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`truncate text-sm ${msg.status === 'unread' ? 'font-semibold' : 'font-medium'}`}>
                              {msg.name}
                            </span>
                            <Badge variant={statusConfig[msg.status].variant} className="shrink-0 text-xs">
                              {statusConfig[msg.status].label}
                            </Badge>
                          </div>
                          <p className="truncate text-sm text-muted-foreground">{msg.subject}</p>
                          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="size-3"/>
                            <span>{formatDate(msg.receivedAt, 'MMM dd, h:mm a')}</span>
                          </div>
                        </div>
                        <ChevronRight className="mt-2 size-4 shrink-0 text-muted-foreground"/>
                      </div>)))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Message Detail */}
        <Card className="lg:col-span-2">
          {selectedMessage ? (<>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSelectedMessage(null)}>
                      <ArrowLeft className="size-4"/>
                    </Button>
                    <div>
                      <CardTitle className="text-lg">{selectedMessage.subject}</CardTitle>
                      <CardDescription>
                        From: {selectedMessage.name} &lt;{selectedMessage.email}&gt;
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={statusConfig[selectedMessage.status].variant}>
                    {statusConfig[selectedMessage.status].label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="size-4"/>
                  <span>Received {formatDate(selectedMessage.receivedAt, 'MMMM dd, yyyy h:mm a')}</span>
                  {selectedMessage.repliedAt && (<>
                      <span className="text-muted-foreground/50">|</span>
                      <Reply className="size-4"/>
                      <span>Replied {formatDate(selectedMessage.repliedAt, 'MMM dd, yyyy')}</span>
                    </>)}
                </div>

                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="whitespace-pre-wrap leading-relaxed">{selectedMessage.message}</p>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {selectedMessage.status === 'unread' && (<Button variant="outline" size="sm" onClick={() => handleMarkAsRead(selectedMessage.id)}>
                      <MailOpen className="mr-2 size-4"/>
                      Mark as Read
                    </Button>)}
                  {selectedMessage.status !== 'replied' && selectedMessage.status !== 'archived' && (<Button size="sm" onClick={() => setReplyDialogOpen(true)}>
                      <Reply className="mr-2 size-4"/>
                      Reply
                    </Button>)}
                  {selectedMessage.status !== 'archived' && (<Button variant="outline" size="sm" onClick={() => handleArchive(selectedMessage.id)}>
                      <Archive className="mr-2 size-4"/>
                      Archive
                    </Button>)}
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(selectedMessage.id)}>
                    <Trash2 className="mr-2 size-4"/>
                    Delete
                  </Button>
                </div>
              </CardContent>
            </>) : (<div className="flex h-full min-h-[400px] items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Mail className="mx-auto mb-3 size-12 opacity-50"/>
                <p>Select a message to view details</p>
              </div>
            </div>)}
        </Card>
      </div>

      {/* Reply Dialog */}
      <Dialog open={replyDialogOpen} onOpenChange={setReplyDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reply to {selectedMessage?.name}</DialogTitle>
            <DialogDescription>
              Send a response to {selectedMessage?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-sm font-medium">Re: {selectedMessage?.subject}</p>
            </div>
            <Textarea placeholder="Type your reply here..." value={replyContent} onChange={(e) => setReplyContent(e.target.value)} rows={6}/>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReply} disabled={!replyContent.trim()}>
              <Reply className="mr-2 size-4"/>
              Send Reply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);
}

'use client';
import { useState, useMemo } from 'react';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { showSuccessAlert, showDeleteConfirm } from '@/lib/alerts';
import { formatDate } from '@/lib/format-date';
import useAdminContent from '@/hooks/use-admin-content';
const statusStyles = {
    published: 'bg-success/15 text-success border-success/30',
    draft: 'bg-warning/15 text-warning-foreground border-warning/30',
    archived: 'bg-muted text-muted-foreground border-border',
};
export function PostsContent() {
    const { items: posts, createItem, updateItem, deleteItem } = useAdminContent('posts', []);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingPost, setEditingPost] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        excerpt: '',
        content: '',
        category: 'blog',
        status: 'draft',
        tags: '',
    });
    const filtered = useMemo(() => {
        return posts.filter((post) => {
            const matchesSearch = post.title.toLowerCase().includes(search.toLowerCase()) ||
                post.author.toLowerCase().includes(search.toLowerCase());
            const matchesStatus = statusFilter === 'all' || post.status === statusFilter;
            const matchesCategory = categoryFilter === 'all' || post.category === categoryFilter;
            return matchesSearch && matchesStatus && matchesCategory;
        });
    }, [posts, search, statusFilter, categoryFilter]);
    const openCreate = () => {
        setEditingPost(null);
        setFormData({ title: '', excerpt: '', content: '', category: 'blog', status: 'draft', tags: '' });
        setDialogOpen(true);
    };
    const openEdit = (post) => {
        setEditingPost(post);
        setFormData({
            title: post.title,
            excerpt: post.excerpt,
            content: post.content,
            category: post.category,
            status: post.status,
            tags: post.tags.join(', '),
        });
        setDialogOpen(true);
    };
    const handleSave = async () => {
        if (editingPost) {
            await updateItem(editingPost.id, {
                ...editingPost,
                ...formData,
                tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
                updatedAt: new Date().toISOString(),
                slug: formData.title.toLowerCase().replace(/\s+/g, '-'),
            });
            showSuccessAlert('Post Updated', `"${formData.title}" has been updated.`);
        }
        else {
            const newPost = {
                title: formData.title,
                slug: formData.title.toLowerCase().replace(/\s+/g, '-'),
                content: formData.content,
                excerpt: formData.excerpt,
                author: 'Ananya Sharma',
                category: formData.category,
                status: formData.status,
                tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                views: 0,
            };
            await createItem(newPost);
            showSuccessAlert('Post Created', `"${formData.title}" has been created.`);
        }
        setDialogOpen(false);
    };
    const handleDelete = async (post) => {
        const result = await showDeleteConfirm(post.title);
        if (result.isConfirmed) {
            await deleteItem(post.id);
            showSuccessAlert('Deleted', `"${post.title}" has been deleted.`);
        }
    };
    return (<div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-balance">Posts</h1>
          <p className="text-muted-foreground">Manage blog posts, announcements, and tutorials.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4"/>
          New Post
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/>
              <Input placeholder="Search posts..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9"/>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Status"/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Category"/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="announcement">Announcement</SelectItem>
                <SelectItem value="blog">Blog</SelectItem>
                <SelectItem value="tutorial">Tutorial</SelectItem>
                <SelectItem value="news">News</SelectItem>
                <SelectItem value="alumni">Alumni</SelectItem>
                <SelectItem value="executive">Executive</SelectItem>
                <SelectItem value="member">Member</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="hidden md:table-cell">Author</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Views</TableHead>
                <TableHead className="hidden lg:table-cell">Date</TableHead>
                <TableHead className="w-[50px]"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (<TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No posts found.</TableCell>
                </TableRow>) : (filtered.map((post) => (<TableRow key={post.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{post.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1 max-w-[300px]">{post.excerpt}</p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{post.author}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{post.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`capitalize ${statusStyles[post.status] || ''}`}>
                        {post.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Eye className="size-3"/>
                        {post.views.toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {formatDate(post.createdAt)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4"/>
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(post)}>
                            <Pencil className="mr-2 size-4"/> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(post)} className="text-destructive">
                            <Trash2 className="mr-2 size-4"/> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>)))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingPost ? 'Edit Post' : 'Create New Post'}</DialogTitle>
            <DialogDescription>{editingPost ? 'Update the post details below.' : 'Fill in the details to create a new post.'}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={formData.title} onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} placeholder="Enter post title"/>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="excerpt">Excerpt</Label>
              <Textarea id="excerpt" value={formData.excerpt} onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))} placeholder="Brief summary of the post" rows={2}/>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="content">Content</Label>
              <Textarea id="content" value={formData.content} onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))} placeholder="Post content..." rows={4}/>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="announcement">Announcement</SelectItem>
                    <SelectItem value="blog">Blog</SelectItem>
                    <SelectItem value="tutorial">Tutorial</SelectItem>
                    <SelectItem value="news">News</SelectItem>
                    <SelectItem value="alumni">Alumni</SelectItem>
                    <SelectItem value="executive">Executive</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input id="tags" value={formData.tags} onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))} placeholder="react, tutorial, beginner"/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!formData.title.trim()}>
              {editingPost ? 'Save Changes' : 'Create Post'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);
}

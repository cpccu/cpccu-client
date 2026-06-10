'use client';
import { useState } from 'react';
import { Search, Plus, MoreHorizontal, GitCommit, ExternalLink, Edit2, Trash2 } from 'lucide-react';
import { FaGithub as Github, FaLinkedin as Linkedin } from 'react-icons/fa';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { showSuccessAlert, showDeleteConfirm } from '@/lib/alerts';
import { formatDate } from '@/lib/format-date';
import useAdminContent from '@/hooks/use-admin-content';
import { AdminImageUploadField } from '@/components/admin-image-upload-field';
export function ContributorsContent() {
    const { items: contributors, createItem, updateItem, deleteItem } = useAdminContent('contributors', []);
    const [searchQuery, setSearchQuery] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingContributor, setEditingContributor] = useState(null);
    const [formData, setFormData] = useState({
        username: '',
        name: '',
        avatarUrl: '',
        githubUrl: '',
        linkedinUrl: '',
        commits: 0,
        role: '',
    });
    const filteredContributors = contributors.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.role.toLowerCase().includes(searchQuery.toLowerCase()));
    const totalCommits = contributors.reduce((sum, c) => sum + c.commits, 0);
    const topContributor = [...contributors].sort((a, b) => b.commits - a.commits)[0];
    const handleOpenDialog = (contributor) => {
        if (contributor) {
            setEditingContributor(contributor);
            setFormData({
                username: contributor.username,
                name: contributor.name,
                avatarUrl: contributor.avatarUrl,
                githubUrl: contributor.githubUrl,
                linkedinUrl: contributor.linkedinUrl || '',
                commits: contributor.commits,
                role: contributor.role,
            });
        }
        else {
            setEditingContributor(null);
            setFormData({
                username: '',
                name: '',
                avatarUrl: '',
                githubUrl: '',
                linkedinUrl: '',
                commits: 0,
                role: '',
            });
        }
        setDialogOpen(true);
    };
    const handleSave = async () => {
        if (editingContributor) {
            await updateItem(editingContributor.id, { ...formData, linkedinUrl: formData.linkedinUrl || undefined });
            showSuccessAlert('Updated!', 'Contributor updated successfully');
        }
        else {
            const newContributor = {
                ...formData,
                linkedinUrl: formData.linkedinUrl || undefined,
                joinedAt: new Date().toISOString(),
            };
            await createItem(newContributor);
            showSuccessAlert('Added!', 'Contributor added successfully');
        }
        setDialogOpen(false);
    };
    const handleDelete = async (id) => {
        const result = await showDeleteConfirm('Remove Contributor', 'This will remove this contributor from the list.');
        if (result.isConfirmed) {
            await deleteItem(id);
            showSuccessAlert('Removed!', 'Contributor removed');
        }
    };
    return (<div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contributors Management</h1>
        <p className="text-muted-foreground">Manage website contributors and their GitHub information.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Contributors</span>
              <span className="text-2xl font-bold">{contributors.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Commits</span>
              <span className="text-2xl font-bold">{totalCommits}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Avg Commits</span>
              <span className="text-2xl font-bold">{contributors.length ? Math.round(totalCommits / contributors.length) : 0}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Top Contributor</span>
              <span className="text-lg font-bold truncate max-w-[100px]">
                {topContributor?.username || '-'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Contributors List</CardTitle>
              <CardDescription>People who contributed to the CPCCU website</CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 size-4"/>
              Add Contributor
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/>
              <Input placeholder="Search by name, username, or role..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9"/>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contributor</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Commits</TableHead>
                  <TableHead>Links</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContributors.length === 0 ? (<TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      No contributors found
                    </TableCell>
                  </TableRow>) : (filteredContributors.map((contributor) => (<TableRow key={contributor.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8">
                            <AvatarImage src={contributor.avatarUrl} alt={contributor.name}/>
                            <AvatarFallback>{contributor.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{contributor.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">@{contributor.username}</code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{contributor.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <GitCommit className="size-3.5 text-muted-foreground"/>
                          <span className="font-medium">{contributor.commits}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" className="size-7" asChild>
                            <a href={contributor.githubUrl} target="_blank" rel="noopener noreferrer">
                              <Github className="size-4"/>
                            </a>
                          </Button>
                          {contributor.linkedinUrl && (<Button variant="ghost" size="icon" className="size-7" asChild>
                              <a href={contributor.linkedinUrl} target="_blank" rel="noopener noreferrer">
                                <Linkedin className="size-4"/>
                              </a>
                            </Button>)}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(contributor.joinedAt)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="size-4"/>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenDialog(contributor)}>
                              <Edit2 className="mr-2 size-4"/>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <a href={contributor.githubUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="mr-2 size-4"/>
                                View GitHub
                              </a>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(contributor.id)}>
                              <Trash2 className="mr-2 size-4"/>
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>)))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingContributor ? 'Edit Contributor' : 'Add New Contributor'}</DialogTitle>
            <DialogDescription>
              {editingContributor ? 'Update contributor details' : 'Add a new contributor to the website'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Name</Label>
                <Input value={formData.name} onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))} placeholder="Full name"/>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Username</Label>
                <Input value={formData.username} onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))} placeholder="GitHub username"/>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Role</Label>
              <Input value={formData.role} onChange={(e) => setFormData((prev) => ({ ...prev, role: e.target.value }))} placeholder="e.g. Lead Developer, Frontend Developer"/>
            </div>
            <AdminImageUploadField
              id="contributor-avatar"
              label="Avatar"
              folder="cpccu/contributors"
              value={formData.avatarUrl}
              onChange={(value) => setFormData((prev) => ({ ...prev, avatarUrl: value }))}
            />
            <div className="flex flex-col gap-2">
              <Label>GitHub URL</Label>
              <Input value={formData.githubUrl} onChange={(e) => setFormData((prev) => ({ ...prev, githubUrl: e.target.value }))} placeholder="https://github.com/username"/>
            </div>
            <div className="flex flex-col gap-2">
              <Label>LinkedIn URL (Optional)</Label>
              <Input value={formData.linkedinUrl} onChange={(e) => setFormData((prev) => ({ ...prev, linkedinUrl: e.target.value }))} placeholder="https://linkedin.com/in/username"/>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Commits Count</Label>
              <Input type="number" value={formData.commits} onChange={(e) => setFormData((prev) => ({ ...prev, commits: parseInt(e.target.value) || 0 }))} placeholder="Number of commits"/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingContributor ? 'Update' : 'Add Contributor'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);
}

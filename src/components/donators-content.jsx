'use client';
import { useState } from 'react';
import { Search, Plus, MoreHorizontal, Heart, Edit2, Trash2, DollarSign, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { showSuccessAlert, showDeleteConfirm } from '@/lib/alerts';
import { formatDate } from '@/lib/format-date';
import useAdminContent from '@/hooks/use-admin-content';
export function DonatorsContent() {
    const { items: donators, createItem, updateItem, deleteItem } = useAdminContent('donators', []);
    const [searchQuery, setSearchQuery] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingDonator, setEditingDonator] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        avatarUrl: '',
        contribution: '',
        amount: 0,
        isAnonymous: false,
    });
    const filteredDonators = donators.filter((d) => d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.contribution.toLowerCase().includes(searchQuery.toLowerCase()));
    const totalAmount = donators.reduce((sum, d) => sum + (d.amount || 0), 0);
    const publicDonators = donators.filter((d) => !d.isAnonymous).length;
    const anonymousDonators = donators.filter((d) => d.isAnonymous).length;
    const handleOpenDialog = (donator) => {
        if (donator) {
            setEditingDonator(donator);
            setFormData({
                name: donator.name,
                avatarUrl: donator.avatarUrl,
                contribution: donator.contribution,
                amount: donator.amount || 0,
                isAnonymous: donator.isAnonymous,
            });
        }
        else {
            setEditingDonator(null);
            setFormData({
                name: '',
                avatarUrl: '',
                contribution: '',
                amount: 0,
                isAnonymous: false,
            });
        }
        setDialogOpen(true);
    };
    const handleSave = async () => {
        if (editingDonator) {
            await updateItem(editingDonator.id, { ...formData, amount: formData.amount || undefined });
            showSuccessAlert('Updated!', 'Donator updated successfully');
        }
        else {
            const newDonator = {
                ...formData,
                amount: formData.amount || undefined,
                donatedAt: new Date().toISOString(),
            };
            await createItem(newDonator);
            showSuccessAlert('Added!', 'Donator added successfully');
        }
        setDialogOpen(false);
    };
    const handleDelete = async (id) => {
        const result = await showDeleteConfirm('Remove Donator', 'This will remove this donator from the list.');
        if (result.isConfirmed) {
            await deleteItem(id);
            showSuccessAlert('Removed!', 'Donator removed');
        }
    };
    return (<div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Donators Management</h1>
        <p className="text-muted-foreground">Manage donors and supporters who contribute to CPCCU.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Heart className="size-4"/>
                <span className="text-sm">Total Donors</span>
              </div>
              <span className="text-2xl font-bold">{donators.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <DollarSign className="size-4"/>
                <span className="text-sm">Total Amount</span>
              </div>
              <span className="text-2xl font-bold">{totalAmount.toLocaleString()} BDT</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Eye className="size-4"/>
                <span className="text-sm">Public</span>
              </div>
              <span className="text-2xl font-bold">{publicDonators}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <EyeOff className="size-4"/>
                <span className="text-sm">Anonymous</span>
              </div>
              <span className="text-2xl font-bold">{anonymousDonators}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Donators List</CardTitle>
              <CardDescription>People who support CPCCU through donations</CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 size-4"/>
              Add Donator
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/>
              <Input placeholder="Search by name or contribution..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9"/>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Donator</TableHead>
                  <TableHead>Contribution</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDonators.length === 0 ? (<TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No donators found
                    </TableCell>
                  </TableRow>) : (filteredDonators.map((donator) => (<TableRow key={donator.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8">
                            {donator.isAnonymous ? (<AvatarFallback>?</AvatarFallback>) : (<>
                                <AvatarImage src={donator.avatarUrl} alt={donator.name}/>
                                <AvatarFallback>{donator.name.charAt(0)}</AvatarFallback>
                              </>)}
                          </Avatar>
                          <span className="font-medium">{donator.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{donator.contribution}</TableCell>
                      <TableCell>
                        {donator.amount ? (<span className="font-medium">{donator.amount.toLocaleString()} BDT</span>) : (<span className="text-muted-foreground">-</span>)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={donator.isAnonymous ? 'secondary' : 'outline'}>
                          {donator.isAnonymous ? 'Anonymous' : 'Public'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(donator.donatedAt)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="size-4"/>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenDialog(donator)}>
                              <Edit2 className="mr-2 size-4"/>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(donator.id)}>
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
            <DialogTitle>{editingDonator ? 'Edit Donator' : 'Add New Donator'}</DialogTitle>
            <DialogDescription>
              {editingDonator ? 'Update donator details' : 'Add a new donator to the list'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label>Name</Label>
              <Input value={formData.name} onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))} placeholder="Full name"/>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Avatar URL (Optional)</Label>
              <Input value={formData.avatarUrl} onChange={(e) => setFormData((prev) => ({ ...prev, avatarUrl: e.target.value }))} placeholder="Profile image URL"/>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Contribution Description</Label>
              <Input value={formData.contribution} onChange={(e) => setFormData((prev) => ({ ...prev, contribution: e.target.value }))} placeholder="e.g. Website Renewal Fee Contribution"/>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Amount (BDT, Optional)</Label>
              <Input type="number" value={formData.amount || ''} onChange={(e) => setFormData((prev) => ({ ...prev, amount: parseInt(e.target.value) || 0 }))} placeholder="Donation amount"/>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="anonymous" checked={formData.isAnonymous} onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isAnonymous: checked === true }))}/>
              <Label htmlFor="anonymous" className="font-normal">Display as anonymous</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingDonator ? 'Update' : 'Add Donator'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);
}

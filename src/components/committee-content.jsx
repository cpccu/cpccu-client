'use client';

import { useMemo, useState } from 'react';
import { Link2, MoreHorizontal, Pencil, Plus, Search, Trash2, UserCog, Users, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { showDeleteConfirm, showErrorAlert, showSuccessAlert } from '@/lib/alerts';
import useAdminContent from '@/hooks/use-admin-content';
import { useGetAdminMembersQuery } from '@/features/admin/adminApi';
import { useGetCertificateSignatoriesQuery } from '@/features/certificate/certificateApi';
import { COMMITTEE_POSITIONS, getCommitteeStartYear, groupCommitteeMembers, isExecutivePosition } from '@/lib/committee';

// The committee list is the server's registry, served by the signatories
// endpoint — the client never repeats the six serials itself.
const NO_COMMITTEE = 'none';

const emptyForm = {
  userId: '',
  position: '',
  committeeKey: '',
  order: '0',
};

/**
 * The account a committee member is linked to, as a plain id string.
 *
 * The stored `userId` is an ObjectId (a string in JSON), but a populated
 * document would carry an object instead — both are handled.
 */
const getLinkedUserId = (member) => {
  const userId = member?.userId;
  if (!userId) return '';
  if (typeof userId === 'object') return String(userId._id || userId.id || '');
  return String(userId);
};

const getErrorMessage = (error) =>
  error?.data?.errors?.[0]?.message ||
  error?.data?.message ||
  'Something went wrong. Please try again.';

/**
 * The searchable list of the site's registered accounts.
 *
 * ⚠️ A COMMITTEE MEMBER IS A REGISTERED USER — the admin PICKS the account
 * instead of typing the person. The picked account's name, email and picture
 * are what the server stores (it derives them), so this picker is the only
 * place a member's identity enters the panel.
 */
function UserPicker({ members, selectedId, search, onSearchChange, onSelect }) {
  return (
    <div className="rounded-md border">
      <div className="relative border-b">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search members by name, email or uniID..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="pl-9 border-0 shadow-none focus-visible:ring-0"
        />
      </div>
      <div className="max-h-44 overflow-y-auto">
        {members.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">No registered members found.</p>
        ) : (
          members.map((member) => {
            const memberId = String(member._id || member.id);
            const isSelected = selectedId === memberId;
            return (
              <button
                key={memberId}
                type="button"
                onClick={() => onSelect(member)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted ${
                  isSelected ? 'bg-muted' : ''
                }`}
              >
                <Avatar className="size-7">
                  <AvatarImage src={member.avatar} alt={member.fullName || member.name} />
                  <AvatarFallback>{(member.fullName || member.name || 'U')[0]}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{member.fullName || member.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {member.email}
                    {member.uniID ? ` · ${member.uniID}` : ''}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export function CommitteeContent() {
  const { items: committeeMembers, createItem, updateItem, deleteItem } = useAdminContent('committees', []);
  const { data: signatoriesResponse } = useGetCertificateSignatoriesQuery();
  const { data: membersResponse } = useGetAdminMembersQuery();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [userSearch, setUserSearch] = useState('');
  // The account the member was linked to when the editor opened — the link is
  // only ever changed when the admin picks a different account.
  const [initialUserId, setInitialUserId] = useState('');
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [accountTarget, setAccountTarget] = useState(null);
  const [accountSearch, setAccountSearch] = useState('');
  const [accountUserId, setAccountUserId] = useState('');

  const committeeOptions = signatoriesResponse?.data?.committees || [];
  const siteMembers = membersResponse?.data || [];

  const membersById = useMemo(() => {
    const byId = new Map();
    siteMembers.forEach((member) => {
      const id = member?._id || member?.id;
      if (id) byId.set(String(id), member);
    });
    return byId;
  }, [siteMembers]);

  // The panel is organised BY COMMITTEE: one group per canonical committee, in
  // the server's chronological order, the last one being the current committee.
  //
  // ⚠️ THE COMMITTEE LIST IS NOT HARDCODED HERE — it comes from the server's
  // registry (the signatories endpoint). If that request has not landed (or
  // failed), the serials the stored members carry are used instead, so the
  // panel still lists every committee instead of showing an empty page. The
  // fallback does NOT decide which committee is the current one.
  const canonicalCommittees = useMemo(() => {
    if (committeeOptions.length) return committeeOptions;

    const keys = [];
    committeeMembers.forEach((member) => {
      const key = member?.committeeKey;
      if (key && !keys.includes(key)) keys.push(key);
    });
    return keys
      .sort((a, b) => (getCommitteeStartYear(a) || 0) - (getCommitteeStartYear(b) || 0))
      .map((key) => ({ key, label: key }));
  }, [committeeOptions, committeeMembers]);

  // The panel lists the committees NEWEST FIRST. The canonical list it is
  // built from stays ascending on purpose: that order is what identifies the
  // current committee (the last entry), so only the output order changes.
  const grouped = useMemo(
    () => groupCommitteeMembers(committeeMembers, canonicalCommittees, { order: 'desc' }),
    [committeeMembers, canonicalCommittees]
  );

  const groups = grouped.groups;
  const currentKey = committeeOptions.length ? grouped.currentKey : null;

  const currentGroup = useMemo(
    () => groups.find((group) => group.key === currentKey) || null,
    [groups, currentKey]
  );

  // The search filters the MEMBERS of every committee; the committees
  // themselves always stay visible.
  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return groups;
    return groups.map((group) => ({
      ...group,
      members: group.members.filter((member) => {
        const text = `${member.fullName || member.name || ''} ${member.email || ''} ${member.position || ''} ${group.label}`.toLowerCase();
        return text.includes(query);
      }),
    }));
  }, [groups, search]);

  const unlinkedCount = useMemo(
    () => committeeMembers.filter((member) => !getLinkedUserId(member)).length,
    [committeeMembers]
  );

  // A committee executive must be linked to a user account; for every other
  // position the link is optional.
  const executiveRequired = isExecutivePosition(formData.position);
  const linkedUser = formData.userId ? membersById.get(String(formData.userId)) : null;
  const orderValue = Number(formData.order);
  const orderValid = Number.isInteger(orderValue) && orderValue >= 0;
  // A member with no account at all has no name to derive, so a CREATE needs
  // one even for a non-executive position. On an EDIT an unlinked legacy
  // member may keep its position — only the executive rule blocks a save.
  const missingAccount = !formData.userId;
  const missingExecutiveUser = executiveRequired && missingAccount;
  const needsAccount = editingMember ? missingExecutiveUser : missingAccount;

  const matchedMembers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    const matched = query
      ? siteMembers.filter((member) =>
          `${member?.fullName || member?.name || ''} ${member?.email || ''} ${member?.uniID || ''}`.toLowerCase().includes(query)
        )
      : siteMembers;
    return matched.slice(0, 50);
  }, [siteMembers, userSearch]);

  const matchedAccountMembers = useMemo(() => {
    const query = accountSearch.trim().toLowerCase();
    const matched = query
      ? siteMembers.filter((member) =>
          `${member?.fullName || member?.name || ''} ${member?.email || ''} ${member?.uniID || ''}`.toLowerCase().includes(query)
        )
      : siteMembers;
    return matched.slice(0, 50);
  }, [siteMembers, accountSearch]);

  const openCreate = (committeeKey) => {
    setEditingMember(null);
    setInitialUserId('');
    setFormData({
      ...emptyForm,
      committeeKey: committeeKey || currentKey || '',
    });
    setUserSearch('');
    setDialogOpen(true);
  };

  const openEdit = (member) => {
    const linkedId = getLinkedUserId(member);
    setEditingMember(member);
    setInitialUserId(linkedId);
    setFormData({
      userId: linkedId,
      position: member.position || '',
      committeeKey: member.committeeKey || '',
      order: String(member.order ?? 0),
    });
    setUserSearch('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    // ⚠️ THE PAYLOAD CARRIES NO PERSON IDENTITY. The server derives the name,
    // email, phone and picture from the linked account, so the client sends
    // only the four fields the endpoint accepts.
    const payload = {
      position: formData.position.trim(),
      committeeKey: formData.committeeKey || null,
      order: orderValue,
    };

    if (formData.userId) {
      payload.userId = formData.userId;
    } else if (initialUserId) {
      // The admin explicitly cleared an existing link.
      payload.userId = null;
    }

    try {
      if (editingMember) {
        await updateItem(editingMember.id, payload);
        showSuccessAlert('Committee Updated', `${formData.position} has been updated.`);
      } else {
        await createItem(payload);
        showSuccessAlert('Committee Added', `${formData.position} has been added.`);
      }
      setDialogOpen(false);
    } catch (error) {
      showErrorAlert('Could not save member', getErrorMessage(error));
    }
  };

  const handleDelete = async (member) => {
    const result = await showDeleteConfirm(member.fullName || member.name);
    if (result.isConfirmed) {
      try {
        await deleteItem(member.id);
        showSuccessAlert('Removed', 'Committee member removed.');
      } catch (error) {
        showErrorAlert('Could not remove member', getErrorMessage(error));
      }
    }
  };

  const openAccountDialog = (member) => {
    setAccountTarget(member);
    setAccountUserId(getLinkedUserId(member));
    setAccountSearch('');
    setAccountDialogOpen(true);
  };

  const handleAccountSave = async () => {
    if (!accountTarget || !accountUserId) return;
    try {
      // The link is the only thing that changes: the member keeps its stored
      // position, committee and order because the server keeps the fields the
      // body omits.
      await updateItem(accountTarget.id, {
        userId: accountUserId,
        position: accountTarget.position,
      });
      showSuccessAlert(
        'Account linked',
        `${accountTarget.fullName || accountTarget.name} is now linked to a registered account.`
      );
      setAccountDialogOpen(false);
    } catch (error) {
      showErrorAlert('Could not link account', getErrorMessage(error));
    }
  };

  const selectUser = (member) => {
    const id = member?._id || member?.id;
    if (!id) return;
    setFormData((prev) => ({ ...prev, userId: String(id) }));
    setUserSearch('');
  };

  const selectAccountUser = (member) => {
    const id = member?._id || member?.id;
    if (!id) return;
    setAccountUserId(String(id));
  };

  const saveDisabled =
    !formData.position.trim() ||
    needsAccount ||
    !orderValid;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-balance">Committees</h1>
          <p className="text-muted-foreground">
            Manage every CPCCU committee. Members are picked from the site&apos;s registered accounts.
          </p>
        </div>
        <Button onClick={() => openCreate(currentKey)} className="gap-2">
          <Plus className="size-4" />
          Add Committee Member
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total members', value: committeeMembers.length },
          { label: 'Committees', value: groups.length },
          { label: 'Current committee', value: currentGroup?.members.length || 0 },
          { label: 'Unlinked accounts', value: unlinkedCount },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-3 pt-4">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                <Users className="size-4 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search members across all committees..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
              />
            </div>
            {search.trim() && (
              <p className="text-sm text-muted-foreground">
                Filtering members in every committee by &quot;{search.trim()}&quot;.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6">
        {filteredGroups.map((group) => {
          const isCurrent = group.key === currentKey;
          return (
            <Card key={group.key}>
              <CardContent className="p-0">
                <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold tracking-tight">{group.label}</h2>
                    {isCurrent && <Badge>Current</Badge>}
                    <span className="text-sm text-muted-foreground">
                      {group.members.length} {group.members.length === 1 ? 'member' : 'members'}
                    </span>
                  </div>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => openCreate(group.key)}>
                    <Plus className="size-4" />
                    Add member
                  </Button>
                </div>

                {group.members.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    {search.trim()
                      ? 'No members in this committee match your search.'
                      : 'No members in this committee yet.'}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Member</TableHead>
                          <TableHead>Position</TableHead>
                          <TableHead>Linked account</TableHead>
                          <TableHead className="w-[80px]">Order</TableHead>
                          <TableHead className="w-[50px]"><span className="sr-only">Actions</span></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.members.map((member) => {
                          const linkedId = getLinkedUserId(member);
                          const linkedMember = linkedId ? membersById.get(linkedId) : null;
                          return (
                            <TableRow key={member.id}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <Avatar className="size-9">
                                    <AvatarImage src={member.avatar || member.img} alt={member.fullName || member.name} />
                                    <AvatarFallback>{(member.fullName || member.name || 'C')[0]}</AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0">
                                    <p className="font-medium">{member.fullName || member.name}</p>
                                    <p className="truncate text-xs text-muted-foreground">{member.email || '—'}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>{member.position}</TableCell>
                              <TableCell>
                                {linkedMember ? (
                                  <div className="flex flex-col">
                                    <span className="text-foreground">{linkedMember.fullName || linkedMember.name}</span>
                                    <span className="text-xs text-muted-foreground">{linkedMember.email}</span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-start gap-1">
                                    <span className="text-muted-foreground">Not linked</span>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 gap-1 px-2 text-xs"
                                      onClick={() => openAccountDialog(member)}
                                    >
                                      <Link2 className="size-3" />
                                      Link account
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground">{member.order ?? 0}</TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="size-8">
                                      <MoreHorizontal className="size-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openEdit(member)}>
                                      <Pencil className="mr-2 size-4" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openAccountDialog(member)}>
                                      <UserCog className="mr-2 size-4" /> Reassign account
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDelete(member)} className="text-destructive">
                                      <Trash2 className="mr-2 size-4" /> Remove
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMember ? 'Edit Committee Member' : 'Add Committee Member'}</DialogTitle>
            <DialogDescription>
              The member&apos;s identity comes from the linked account — the server derives the name, email and
              picture from it.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
            <div className="sm:col-span-2 flex flex-col gap-2">
              <Label>
                Account{executiveRequired ? ' *' : ''}
              </Label>
              {linkedUser && (
                <div className="flex items-center gap-3 rounded-md border p-2">
                  <Avatar className="size-9">
                    <AvatarImage src={linkedUser.avatar} alt={linkedUser.fullName || linkedUser.name} />
                    <AvatarFallback>{(linkedUser.fullName || linkedUser.name || 'U')[0]}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{linkedUser.fullName || linkedUser.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{linkedUser.email}</p>
                    {linkedUser.uniID && (
                      <p className="truncate text-xs text-muted-foreground">Uni ID: {linkedUser.uniID}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="ml-auto size-8"
                    onClick={() => setFormData((prev) => ({ ...prev, userId: '' }))}
                  >
                    <X className="size-4" />
                    <span className="sr-only">Clear linked account</span>
                  </Button>
                </div>
              )}
              <UserPicker
                members={matchedMembers}
                selectedId={formData.userId}
                search={userSearch}
                onSearchChange={setUserSearch}
                onSelect={selectUser}
              />
              {executiveRequired && missingExecutiveUser && (
                <p className="text-xs text-destructive">A committee executive must be linked to a user account.</p>
              )}
              {!executiveRequired && missingAccount && !editingMember && (
                <p className="text-xs text-muted-foreground">
                  Pick the registered account this committee member belongs to.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label>Position *</Label>
              <Input
                list="committee-positions"
                value={formData.position}
                onChange={(event) => setFormData((prev) => ({ ...prev, position: event.target.value }))}
                placeholder="President"
              />
              <datalist id="committee-positions">
                {COMMITTEE_POSITIONS.map((position) => (
                  <option key={position} value={position} />
                ))}
              </datalist>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Sort Order</Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={formData.order}
                onChange={(event) => setFormData((prev) => ({ ...prev, order: event.target.value }))}
              />
              {!orderValid && (
                <p className="text-xs text-destructive">Order must be a whole number of 0 or more.</p>
              )}
            </div>
            <div className="sm:col-span-2 flex flex-col gap-2">
              <Label>Committee</Label>
              <Select
                value={formData.committeeKey || NO_COMMITTEE}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, committeeKey: value === NO_COMMITTEE ? '' : value }))
                }
              >
                <SelectTrigger><SelectValue placeholder="Select a committee" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_COMMITTEE}>Not assigned</SelectItem>
                  {committeeOptions.map((committee) => (
                    <SelectItem key={committee.key} value={committee.key}>{committee.label || committee.key}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saveDisabled}>
              {editingMember ? 'Save Changes' : 'Add Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {accountTarget && getLinkedUserId(accountTarget) ? 'Reassign account' : 'Link account'}
            </DialogTitle>
            <DialogDescription>
              {accountTarget?.fullName || accountTarget?.name} will be linked to the account you pick. The member keeps
              their position, committee and order.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <UserPicker
              members={matchedAccountMembers}
              selectedId={accountUserId}
              search={accountSearch}
              onSearchChange={setAccountSearch}
              onSelect={selectAccountUser}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccountDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAccountSave} disabled={!accountUserId}>
              {accountTarget && getLinkedUserId(accountTarget) ? 'Reassign account' : 'Link account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

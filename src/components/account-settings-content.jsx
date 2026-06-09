'use client';
import { useEffect, useRef, useState } from 'react';
import { Save, User, Mail, Phone, Lock, Camera } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { showDeleteConfirm, showSuccessAlert } from '@/lib/alerts';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { clearCredentials, setCredentials } from '@/features/auth/authSlice';
import { useChangePasswordMutation, useDeleteOwnAccountMutation, useUpdateUserMutation, useUserImageUploadMutation } from '@/features/users/userApi';
export function AccountSettingsContent() {
    const user = useSelector((state) => state.auth.user);
    const token = useSelector((state) => state.auth.token);
    const dispatch = useDispatch();
    const router = useRouter();
    const imageInputRef = useRef(null);
    const [updateUser] = useUpdateUserMutation();
    const [changePassword] = useChangePasswordMutation();
    const [deleteOwnAccount] = useDeleteOwnAccountMutation();
    const [userImageUpload] = useUserImageUploadMutation();
    const [profile, setProfile] = useState({
        name: 'Ananya Sharma',
        email: 'ananya@cpccu.club',
        phone: '+91 98765 43210',
        bio: 'Administrator of the CPCCU Programming Club. Passionate about Machine Learning and Web Development.',
        department: 'Computer Science',
        avatar: '',
    });
    const [password, setPassword] = useState({
        current: '',
        newPassword: '',
        confirmPassword: '',
    });
    useEffect(() => {
        if (user) {
            setProfile((current) => ({
                ...current,
                name: user.fullName || current.name,
                email: user.email || current.email,
                phone: user.phone || '',
                bio: user.bio || '',
                department: user.section || '',
                avatar: user.avatar || '',
            }));
        }
    }, [user]);
    const handleProfileSave = async () => {
        const response = await updateUser({
            fullName: profile.name,
            email: profile.email,
            phone: profile.phone,
            bio: profile.bio,
            section: profile.department,
        }).unwrap();
        dispatch(setCredentials({ user: response.data, token }));
        showSuccessAlert('Profile Updated', 'Your account details have been saved.');
    };
    const handlePasswordChange = async () => {
        if (!password.current || !password.newPassword || !password.confirmPassword)
            return;
        if (password.newPassword !== password.confirmPassword)
            return;
        await changePassword({
            currentPassword: password.current,
            newPassword: password.newPassword,
        });
        setPassword({ current: '', newPassword: '', confirmPassword: '' });
        showSuccessAlert('Password Changed', 'Your password has been updated successfully.');
    };
    const handlePhotoChange = async (event) => {
        const image = event.target.files?.[0];
        if (!image)
            return;
        const imageData = new FormData();
        imageData.append('image', image);
        const response = await userImageUpload({ key: 'avatar', imageData }).unwrap();
        dispatch(setCredentials({ user: response.data, token }));
        setProfile((current) => ({ ...current, avatar: response.data.avatar || current.avatar }));
        event.target.value = '';
        showSuccessAlert('Photo Updated', 'Your profile photo has been uploaded.');
    };
    const handleDeleteAccount = async () => {
        const result = await showDeleteConfirm('Delete Account', 'This permanently removes your account and signs you out.');
        if (!result.isConfirmed)
            return;
        await deleteOwnAccount().unwrap();
        dispatch(clearCredentials());
        router.replace('/');
    };
    const initials = (profile.name || 'CPCCU').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
    return (<div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-balance">Account Settings</h1>
        <p className="text-muted-foreground">Manage your personal account and security preferences.</p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your personal details and bio.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <Avatar className="size-20">
              <AvatarImage src={profile.avatar} alt={profile.name}/>
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1.5">
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange}/>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => imageInputRef.current?.click()}>
                <Camera className="size-4"/>
                Change Photo
              </Button>
              <p className="text-xs text-muted-foreground">JPG, PNG or GIF. Max 2MB.</p>
            </div>
          </div>

          <Separator />

          {/* Form Fields */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="acc-name">
                <User className="mr-1.5 inline size-3.5"/>
                Full Name
              </Label>
              <Input id="acc-name" value={profile.name} onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}/>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="acc-email">
                <Mail className="mr-1.5 inline size-3.5"/>
                Email Address
              </Label>
              <Input id="acc-email" type="email" value={profile.email} onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}/>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="acc-phone">
                <Phone className="mr-1.5 inline size-3.5"/>
                Phone Number
              </Label>
              <Input id="acc-phone" value={profile.phone} onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}/>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="acc-dept">Department</Label>
              <Input id="acc-dept" value={profile.department} onChange={(e) => setProfile(prev => ({ ...prev, department: e.target.value }))}/>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="acc-bio">Bio</Label>
            <Textarea id="acc-bio" value={profile.bio} onChange={(e) => setProfile(prev => ({ ...prev, bio: e.target.value }))} rows={3} placeholder="Tell us about yourself..."/>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleProfileSave} className="gap-2">
              <Save className="size-4"/>
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Password Section */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Lock className="mr-2 inline size-4"/>
            Change Password
          </CardTitle>
          <CardDescription>Update your password to keep your account secure.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="pw-current">Current Password</Label>
              <Input id="pw-current" type="password" value={password.current} onChange={(e) => setPassword(prev => ({ ...prev, current: e.target.value }))} placeholder="Enter current password"/>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pw-new">New Password</Label>
              <Input id="pw-new" type="password" value={password.newPassword} onChange={(e) => setPassword(prev => ({ ...prev, newPassword: e.target.value }))} placeholder="Enter new password"/>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pw-confirm">Confirm New Password</Label>
              <Input id="pw-confirm" type="password" value={password.confirmPassword} onChange={(e) => setPassword(prev => ({ ...prev, confirmPassword: e.target.value }))} placeholder="Confirm new password"/>
            </div>
          </div>
          {password.newPassword && password.confirmPassword && password.newPassword !== password.confirmPassword && (<p className="text-sm text-destructive">Passwords do not match.</p>)}
          <div className="flex justify-end">
            <Button onClick={handlePasswordChange} disabled={!password.current || !password.newPassword || password.newPassword !== password.confirmPassword} variant="outline" className="gap-2">
              <Lock className="size-4"/>
              Update Password
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions related to your account.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Delete Account</p>
            <p className="text-xs text-muted-foreground">Permanently delete your account and all associated data.</p>
          </div>
          <Button variant="destructive" size="sm" onClick={handleDeleteAccount}>Delete Account</Button>
        </CardContent>
      </Card>
    </div>);
}

'use client';
import { useEffect, useState } from 'react';
import { Save, Globe, Bell, Shield, Palette, Clock, Search, Wrench } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { showSuccessAlert } from '@/lib/alerts';
import { useGetAdminSystemSettingsQuery, useUpdateAdminSystemSettingsMutation } from '@/features/admin/adminApi';
export function SystemSettingsContent() {
    const [general, setGeneral] = useState({
        siteName: 'CPCCU Programming Club',
        siteUrl: 'https://cpccu.club',
        timezone: 'Asia/Dhaka',
        language: 'en',
    });
    const [notifications, setNotifications] = useState({
        emailNewMember: true,
        emailNewPost: false,
        emailEventRegistration: true,
        emailProfileSubmission: true,
        browserNotifications: true,
    });
    const [security, setSecurity] = useState({
        twoFactor: false,
        sessionTimeout: '60',
        loginAttempts: '5',
    });
    const [appearance, setAppearance] = useState({
        theme: 'system',
        compactMode: false,
        primaryColor: '#3b82f6',
        logoUrl: '/assets/logo/cpccu.png',
        occasionTheme: 'default',
    });
    const [siteMetadata, setSiteMetadata] = useState({
        seoTitle: 'CPCCU Programming Club',
        seoDescription: 'Competitive Programming Camp at City University',
        contactEmail: 'cpccu@cityuniversity.edu.bd',
        facebookUrl: '',
        githubUrl: '',
        linkedinUrl: '',
    });
    const [maintenance, setMaintenance] = useState({
        enabled: false,
        message: 'CPCCU is performing scheduled maintenance.',
    });
    const { data: settingsResponse } = useGetAdminSystemSettingsQuery();
    const [updateSettings] = useUpdateAdminSystemSettingsMutation();
    useEffect(() => {
        const settings = settingsResponse?.data;
        if (settings?.general && Object.keys(settings.general).length) setGeneral(settings.general);
        if (settings?.notifications && Object.keys(settings.notifications).length) setNotifications(settings.notifications);
        if (settings?.security && Object.keys(settings.security).length) setSecurity(settings.security);
        if (settings?.appearance && Object.keys(settings.appearance).length) setAppearance(settings.appearance);
        if (settings?.siteMetadata && Object.keys(settings.siteMetadata).length) setSiteMetadata(settings.siteMetadata);
        if (settings?.maintenance && Object.keys(settings.maintenance).length) setMaintenance(settings.maintenance);
    }, [settingsResponse]);
    const handleSave = async () => {
        await updateSettings({ general, notifications, security, appearance, siteMetadata, maintenance });
        showSuccessAlert('Settings Saved', 'System settings have been updated.');
    };
    return (<div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-balance">System Settings</h1>
        <p className="text-muted-foreground">Configure global settings for the admin panel.</p>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Globe className="mr-2 inline size-4"/>
            General
          </CardTitle>
          <CardDescription>Basic site configuration and regional settings.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="sys-name">Site Name</Label>
              <Input id="sys-name" value={general.siteName} onChange={(e) => setGeneral(prev => ({ ...prev, siteName: e.target.value }))}/>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="sys-url">Site URL</Label>
              <Input id="sys-url" value={general.siteUrl} onChange={(e) => setGeneral(prev => ({ ...prev, siteUrl: e.target.value }))}/>
            </div>
            <div className="flex flex-col gap-2">
              <Label>
                <Clock className="mr-1.5 inline size-3.5"/>
                Timezone
              </Label>
              <Select value={general.timezone} onValueChange={(v) => setGeneral(prev => ({ ...prev, timezone: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Asia/Dhaka">Asia/Dhaka (BST)</SelectItem>
                  <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                  <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                  <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                  <SelectItem value="Asia/Tokyo">Asia/Tokyo (JST)</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Language</Label>
              <Select value={general.language} onValueChange={(v) => setGeneral(prev => ({ ...prev, language: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="hi">Hindi</SelectItem>
                  <SelectItem value="bn">Bengali</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <Search className="mr-2 inline size-4"/>
            Site Metadata
          </CardTitle>
          <CardDescription>SEO, contact, and social links used by the public website.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="seo-title">SEO Title</Label>
            <Input id="seo-title" value={siteMetadata.seoTitle} onChange={(e) => setSiteMetadata(prev => ({ ...prev, seoTitle: e.target.value }))}/>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="contact-email">Contact Email</Label>
            <Input id="contact-email" value={siteMetadata.contactEmail} onChange={(e) => setSiteMetadata(prev => ({ ...prev, contactEmail: e.target.value }))}/>
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="seo-description">SEO Description</Label>
            <Input id="seo-description" value={siteMetadata.seoDescription} onChange={(e) => setSiteMetadata(prev => ({ ...prev, seoDescription: e.target.value }))}/>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="facebook-url">Facebook URL</Label>
            <Input id="facebook-url" value={siteMetadata.facebookUrl} onChange={(e) => setSiteMetadata(prev => ({ ...prev, facebookUrl: e.target.value }))}/>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="github-url">GitHub URL</Label>
            <Input id="github-url" value={siteMetadata.githubUrl} onChange={(e) => setSiteMetadata(prev => ({ ...prev, githubUrl: e.target.value }))}/>
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="linkedin-url">LinkedIn URL</Label>
            <Input id="linkedin-url" value={siteMetadata.linkedinUrl} onChange={(e) => setSiteMetadata(prev => ({ ...prev, linkedinUrl: e.target.value }))}/>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Bell className="mr-2 inline size-4"/>
            Notifications
          </CardTitle>
          <CardDescription>Choose what email and browser notifications you receive.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {[
            { key: 'emailNewMember', label: 'New member registration', description: 'Receive an email when a new member signs up.' },
            { key: 'emailNewPost', label: 'New post published', description: 'Get notified when a post is published.' },
            { key: 'emailEventRegistration', label: 'Event registration', description: 'Email alerts for new event registrations.' },
            { key: 'emailProfileSubmission', label: 'Developer profile submission', description: 'Notified when a student submits their profile to the pipeline.' },
            { key: 'browserNotifications', label: 'Browser notifications', description: 'Enable push notifications in the browser.' },
        ].map((item, index) => (<div key={item.key}>
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
                <Switch checked={notifications[item.key]} onCheckedChange={(v) => setNotifications(prev => ({ ...prev, [item.key]: v }))}/>
              </div>
              {index < 4 && <Separator />}
            </div>))}
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Shield className="mr-2 inline size-4"/>
            Security
          </CardTitle>
          <CardDescription>Security policies for admin authentication.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Two-Factor Authentication</p>
              <p className="text-xs text-muted-foreground">Require 2FA for all admin logins.</p>
            </div>
            <Switch checked={security.twoFactor} onCheckedChange={(v) => setSecurity(prev => ({ ...prev, twoFactor: v }))}/>
          </div>
          <Separator />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
              <Input id="session-timeout" type="number" value={security.sessionTimeout} onChange={(e) => setSecurity(prev => ({ ...prev, sessionTimeout: e.target.value }))}/>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-attempts">Max Login Attempts</Label>
              <Input id="login-attempts" type="number" value={security.loginAttempts} onChange={(e) => setSecurity(prev => ({ ...prev, loginAttempts: e.target.value }))}/>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appearance Settings */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Wrench className="mr-2 inline size-4"/>
            Maintenance Mode
          </CardTitle>
          <CardDescription>Temporarily show a maintenance message on the public site.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Enable Maintenance Mode</p>
              <p className="text-xs text-muted-foreground">Use this during deployments or emergency updates.</p>
            </div>
            <Switch checked={maintenance.enabled} onCheckedChange={(v) => setMaintenance(prev => ({ ...prev, enabled: v }))}/>
          </div>
          <Separator />
          <div className="flex flex-col gap-2">
            <Label htmlFor="maintenance-message">Maintenance Message</Label>
            <Input id="maintenance-message" value={maintenance.message} onChange={(e) => setMaintenance(prev => ({ ...prev, message: e.target.value }))}/>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <Palette className="mr-2 inline size-4"/>
            Appearance
          </CardTitle>
          <CardDescription>Theme, logo, and special occasion styling.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Theme</Label>
              <Select value={appearance.theme} onValueChange={(v) => setAppearance(prev => ({ ...prev, theme: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Occasion Theme</Label>
              <Select value={appearance.occasionTheme} onValueChange={(v) => setAppearance(prev => ({ ...prev, occasionTheme: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="eid">EID Special</SelectItem>
                  <SelectItem value="contest">Contest Week</SelectItem>
                  <SelectItem value="freshers">Freshers Welcome</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="primary-color">Primary Color</Label>
              <div className="flex gap-2">
                <Input id="primary-color" type="color" value={appearance.primaryColor} onChange={(e) => setAppearance(prev => ({ ...prev, primaryColor: e.target.value }))} className="w-16 p-1"/>
                <Input value={appearance.primaryColor} onChange={(e) => setAppearance(prev => ({ ...prev, primaryColor: e.target.value }))}/>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="logo-url">Logo URL</Label>
              <Input id="logo-url" value={appearance.logoUrl} onChange={(e) => setAppearance(prev => ({ ...prev, logoUrl: e.target.value }))}/>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Compact Mode</p>
              <p className="text-xs text-muted-foreground">Reduce spacing for a denser layout.</p>
            </div>
            <Switch checked={appearance.compactMode} onCheckedChange={(v) => setAppearance(prev => ({ ...prev, compactMode: v }))}/>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} className="gap-2" size="lg">
          <Save className="size-4"/>
          Save All Settings
        </Button>
      </div>
    </div>);
}

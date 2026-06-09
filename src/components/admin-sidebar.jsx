'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, FileText, Users, Calendar, Image as ImageIcon, Briefcase, Settings, LogOut, ChevronDown, Code2, UserCog, Wrench, Mail, Award, GitPullRequest, Heart, BarChart3, Home, } from 'lucide-react';
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarSeparator, } from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { useLogoutMutation } from '@/features/auth/authApi';
import { clearCredentials } from '@/features/auth/authSlice';
const navItems = [
    { title: 'Dashboard', href: '/admin', icon: LayoutDashboard, roles: ['admin', 'moderator', 'mentor'] },
    { title: 'Posts', href: '/admin/posts', icon: FileText, roles: ['admin', 'moderator'] },
    { title: 'Members', href: '/admin/members', icon: Users, roles: ['admin', 'mentor'] },
    { title: 'Events', href: '/admin/events', icon: Calendar, roles: ['admin', 'moderator'] },
    { title: 'Gallery', href: '/admin/gallery', icon: ImageIcon, roles: ['admin', 'moderator'] },
    { title: 'Certificates', href: '/admin/certificates', icon: Award, roles: ['admin', 'mentor'] },
    { title: 'Contributors', href: '/admin/contributors', icon: GitPullRequest, roles: ['admin'] },
    { title: 'Donators', href: '/admin/donators', icon: Heart, roles: ['admin'] },
    { title: 'Developer Profiles', href: '/admin/jobs', icon: Briefcase, roles: ['admin'] },
    { title: 'Contact Messages', href: '/admin/messages', icon: Mail, roles: ['admin'] },
    { title: 'Site Statistics', href: '/admin/statistics', icon: BarChart3, roles: ['admin', 'moderator', 'mentor'] },
];
const settingsItems = [
    { title: 'Account Settings', href: '/admin/settings/account', icon: UserCog, roles: ['admin', 'moderator', 'mentor'] },
    { title: 'System Settings', href: '/admin/settings/system', icon: Wrench, roles: ['admin'] },
];
export function AdminSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const dispatch = useDispatch();
    const user = useSelector((state) => state.auth.user);
    const role = user?.roles?.role || 'member';
    const visibleNavItems = navItems.filter((item) => item.roles.includes(role));
    const visibleSettingsItems = settingsItems.filter((item) => item.roles.includes(role));
    const [logout] = useLogoutMutation();
    const handleLogout = async () => {
        await logout();
        dispatch(clearCredentials());
        router.push('/login');
    };
    return (<Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="px-4 py-5">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/admin" className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Code2 className="size-4"/>
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold">CPCCU Admin</span>
                  <span className="text-xs text-sidebar-foreground/60">Club Management</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleNavItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            return (<SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                      <Link href={item.href}>
                        <item.icon className="size-4"/>
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>);
        })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleSettingsItems.map((item) => {
            const isActive = pathname === item.href;
            return (<SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                      <Link href={item.href}>
                        <item.icon className="size-4"/>
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>);
        })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Back to website">
              <Link href="/">
                <Home className="size-4"/>
                <span>Back to Website</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="cursor-pointer">
                  <Avatar className="size-7">
                  <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">{user?.fullName?.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'AD'}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-1 flex-col leading-tight">
                    <span className="text-sm font-medium">{user?.fullName || 'Administrator'}</span>
                    <span className="text-xs capitalize text-sidebar-foreground/60">{role}</span>
                  </div>
                  <ChevronDown className="ml-auto size-4"/>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-[--radix-dropdown-menu-trigger-width]">
                <DropdownMenuItem asChild>
                  <Link href="/admin/settings/account">
                    <Settings className="mr-2 size-4"/>
                    Account Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={handleLogout}>
                  <LogOut className="mr-2 size-4"/>
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>);
}

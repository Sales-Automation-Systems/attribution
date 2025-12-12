import {
  LayoutDashboard,
  Users,
  Target,
  FileText,
  Settings,
  Activity,
  AlertCircle,
  Server,
  type LucideIcon,
} from 'lucide-react';

export interface NavSubItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
}

export interface NavMainItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  subItems?: NavSubItem[];
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
}

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    label: 'Attribution',
    items: [
      {
        title: 'Dashboard',
        url: '/dashboard',
        icon: LayoutDashboard,
      },
      {
        title: 'Clients',
        url: '/dashboard/clients',
        icon: Users,
      },
    ],
  },
  {
    id: 2,
    label: 'Admin',
    items: [
      {
        title: 'Processing Jobs',
        url: '/dashboard/admin/processing',
        icon: Server,
      },
      {
        title: 'System Health',
        url: '/dashboard/admin/health',
        icon: Activity,
      },
      {
        title: 'Logs & Errors',
        url: '/dashboard/admin/logs',
        icon: AlertCircle,
      },
    ],
  },
];

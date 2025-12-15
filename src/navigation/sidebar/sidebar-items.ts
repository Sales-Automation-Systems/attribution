import {
  LayoutDashboard,
  Users,
  Settings,
  Activity,
  AlertCircle,
  Server,
  Flag,
  DollarSign,
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
      {
        title: 'Tasks',
        url: '/dashboard/tasks',
        icon: Flag,
      },
      {
        title: 'Reconciliation',
        url: '/dashboard/reconciliation',
        icon: DollarSign,
      },
    ],
  },
  {
    id: 3,
    label: 'Testing',
    items: [
      {
        title: 'Directive Tasks',
        url: '/client/directive/1ed19113-f2cd-47db-a97d-a5762622f60c/tasks',
        icon: Flag,
      },
    ],
  },
  {
    id: 2,
    label: 'Admin',
    items: [
      {
        title: 'Client Settings',
        url: '/dashboard/admin/settings',
        icon: Settings,
      },
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



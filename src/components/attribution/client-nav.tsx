'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, DollarSign, Flag } from 'lucide-react';

interface ClientNavProps {
  slug: string;
  uuid: string;
}

const navItems = [
  { label: 'Dashboard', path: '', icon: LayoutDashboard },
  { label: 'Reconciliation', path: '/reconciliation', icon: DollarSign },
  { label: 'Tasks', path: '/tasks', icon: Flag },
];

export function ClientNav({ slug, uuid }: ClientNavProps) {
  const pathname = usePathname();
  const basePath = `/client/${slug}/${uuid}`;

  return (
    <nav className="flex gap-1 mb-6 border-b pb-4">
      {navItems.map((item) => {
        const href = `${basePath}${item.path}`;
        const isActive = pathname === href || (item.path === '' && pathname === basePath);
        
        return (
          <Link
            key={item.path}
            href={href}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}



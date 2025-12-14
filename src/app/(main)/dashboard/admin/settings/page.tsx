import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings } from 'lucide-react';
import { ClientSettingsTable } from './client-settings-table';

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Client Settings</h1>
          <p className="text-muted-foreground">
            Configure attribution settings and revenue share rates for each client
          </p>
        </div>
      </div>

      {/* Legend */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Attribution Modes</CardTitle>
          <CardDescription>Understanding the settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Per Event</h4>
              <p className="text-sm text-muted-foreground">
                Each event is counted individually. If joe@apple.com signs up (direct match) and 
                sally@apple.com signs up (company match), that&apos;s 2 sign-ups.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Per Domain</h4>
              <p className="text-sm text-muted-foreground">
                Events are consolidated by domain. Multiple sign-ups from apple.com count as 
                1 attributed domain. Best for account-based billing.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Clients</CardTitle>
          <CardDescription>
            Click on any cell to edit. Changes are saved automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClientSettingsTable />
        </CardContent>
      </Card>
    </div>
  );
}

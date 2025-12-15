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
          <CardTitle className="text-lg">Settings Guide</CardTitle>
          <CardDescription>Understanding billing and attribution settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <h4 className="font-semibold text-sm border-b pb-1">Billing Models</h4>
              <div className="space-y-2">
                <div>
                  <span className="font-medium text-sm">Flat RevShare:</span>
                  <p className="text-sm text-muted-foreground">
                    Single revenue share rate applies to all paying customers regardless of how they converted.
                  </p>
                </div>
                <div>
                  <span className="font-medium text-sm">PLG/Sales Split:</span>
                  <p className="text-sm text-muted-foreground">
                    Different rates for PLG (no meeting before paying) vs Sales-assisted (had meeting before paying).
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold text-sm border-b pb-1">Attribution Modes</h4>
              <div className="space-y-2">
                <div>
                  <span className="font-medium text-sm">Per Event:</span>
                  <p className="text-sm text-muted-foreground">
                    Each event counted individually. 2 people from apple.com = 2 sign-ups.
                  </p>
                </div>
                <div>
                  <span className="font-medium text-sm">Per Domain:</span>
                  <p className="text-sm text-muted-foreground">
                    Consolidated by domain. Multiple sign-ups from apple.com = 1 domain.
                  </p>
                </div>
              </div>
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

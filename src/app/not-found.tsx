import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">404 Not Found</h1>
      <p className="text-muted-foreground">The page you are looking for does not exist.</p>
      <Link prefetch={false} replace href="/dashboard">
        <Button className="mt-4">Go to Dashboard</Button>
      </Link>
    </div>
  );
}

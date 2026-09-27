import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import LogoutButton from "@/components/auth/logout-button";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-semibold">Welcome to CareerConnect</h1>
        <p className="mt-2 text-muted-foreground">
          Signed in as <span className="font-medium">{user.email}</span>
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Your dashboard is coming soon.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/upload-resume" className={buttonVariants({ size: "lg" })}>
            Upload resume
          </Link>
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
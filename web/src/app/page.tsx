import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-4xl font-semibold">CareerConnect</h1>
        <p className="mt-3 text-muted-foreground">
          Organize your job search, track applications, and stay on top of
          every opportunity in one place.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/auth/login" className={buttonVariants({ size: "lg" })}>
            Log in
          </Link>
          <Link
            href="/auth/signup"
            className={buttonVariants({ size: "lg", variant: "outline" })}
          >
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}

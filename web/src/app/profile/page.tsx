import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profiles/profile";
import { ProfileEditor, type ProfileData } from "@/components/profile/profile-editor";

export default async function ProfilePage() {
  const result = await getCurrentProfile();

  if (!("profile" in result) || !result.profile) {
    const error = "error" in result ? result.error : "Unable to load your profile.";

    if (error.startsWith("Unable to authenticate")) {
      redirect("/auth/login");
    }

    return (
      <main className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto w-full max-w-2xl">
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
          <Link href="/dashboard" className="mt-4 inline-block text-sm hover:underline">
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  const profile: ProfileData = {
    full_name: result.profile.full_name ?? null,
    bio: result.profile.bio ?? null,
    location: result.profile.location ?? null,
    contact_email: result.profile.contact_email ?? null,
    avatar_path: result.profile.avatar_path ?? null,
    background_path: result.profile.background_path ?? null,
  };

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">My profile</h1>
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:underline"
          >
            Back to dashboard
          </Link>
        </div>

        <ProfileEditor initialProfile={profile} />
      </div>
    </main>
  );
}

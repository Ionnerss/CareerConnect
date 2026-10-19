import type { Metadata } from "next";
import SignupForm from "@/components/auth/signup-form";
import { parseLoginRole } from "@/lib/auth/roles";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create a CareerConnect account as a job seeker or a recruiter.",
};

type SignupPageProps = {
  searchParams: Promise<{ as?: string | string[] }>;
};

/** `/auth/signup?as=recruiter` opens the recruiter tab. Links from the homepage use it. */
export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { as } = await searchParams;

  return <SignupForm initialRole={parseLoginRole(as)} />;
}

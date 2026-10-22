import type { Metadata } from "next";
import LoginForm from "@/components/auth/login-form";
import { parseLoginRole } from "@/lib/auth/roles";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to CareerConnect as a job seeker or a recruiter.",
};

type LoginPageProps = {
  searchParams: Promise<{ as?: string | string[] }>;
};

/** `/auth/login?as=recruiter` opens the recruiter tab. Links from the homepage use it. */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { as } = await searchParams;

  return <LoginForm initialRole={parseLoginRole(as)} />;
}

import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function SignInPage() {
  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <SignIn
        path="/signin"
        forceRedirectUrl="/"
        appearance={{ theme: dark }}
      />
    </div>
  );
}

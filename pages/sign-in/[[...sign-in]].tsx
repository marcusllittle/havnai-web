import React from "react";
import { SignIn } from "@clerk/nextjs";
import { SiteHeader } from "../../components/SiteHeader";
import { accountsConfigured } from "../../components/AccountProvider";

export default function SignInPage() {
  return <><SiteHeader /><main className="account-auth-page"><h1>Welcome back.</h1>
    <p>Your creations, credits, and library. No wallet required.</p>
    {accountsConfigured ? <SignIn routing="path" path="/sign-in" /> : <p role="status">Account sign-in is not available yet. Please try again later.</p>}
  </main></>;
}

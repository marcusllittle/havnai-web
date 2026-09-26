import React from "react";
import { SignUp } from "@clerk/nextjs";
import { SiteHeader } from "../../components/SiteHeader";
import { accountsConfigured } from "../../components/AccountProvider";

export default function SignUpPage() {
  return <><SiteHeader /><main className="account-auth-page"><h1>Make it yours.</h1>
    <p>Create your HavnAI account. A wallet is optional.</p>
    {accountsConfigured ? <SignUp routing="path" path="/sign-up" /> : <p role="status">Account registration is not available yet. Please try again later.</p>}
  </main></>;
}

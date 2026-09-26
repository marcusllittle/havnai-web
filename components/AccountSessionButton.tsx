import Link from "next/link";
import { useRef, useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { LoaderCircle, LogIn, LogOut } from "lucide-react";
import { useAccount } from "./AccountProvider";

export function AccountSessionButton() {
  const { loading, signedIn } = useAccount();
  if (signedIn) return <SignOutControl />;
  if (loading) return <button className="account-session-button" type="button" disabled aria-label="Loading account">
    <LoaderCircle size={17} className="account-session-spinner" aria-hidden="true" />Loading
  </button>;
  return <Link className="account-session-button" href="/sign-in"><LogIn size={17} aria-hidden="true" />Sign in</Link>;
}

function SignOutControl() {
  const { signOut } = useClerk();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  async function handleSignOut() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    try {
      await signOut({ redirectUrl: "/" });
    } catch {
      setError("Couldn't sign out. Please try again.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return <div className="account-session-control">
    <button className="account-session-button" type="button" disabled={pending} onClick={() => void handleSignOut()}>
      {pending ? <LoaderCircle size={17} className="account-session-spinner" aria-hidden="true" /> : <LogOut size={17} aria-hidden="true" />}
      {pending ? "Signing out…" : "Sign out"}
    </button>
    {error && <p className="account-session-error" role="alert">{error}</p>}
  </div>;
}

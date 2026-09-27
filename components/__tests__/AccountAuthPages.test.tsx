import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SignInPage from "../../pages/sign-in/[[...sign-in]]";
import SignUpPage from "../../pages/sign-up/[[...sign-up]]";

const clerkProps = vi.hoisted(() => ({ signIn: [] as any[], signUp: [] as any[] }));

vi.mock("../SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("../AccountProvider", () => ({ accountsConfigured: true }));
vi.mock("@clerk/nextjs", () => ({
  SignIn: (props: any) => {
    clerkProps.signIn.push(props);
    return <div data-testid="sign-in" />;
  },
  SignUp: (props: any) => {
    clerkProps.signUp.push(props);
    return <div data-testid="sign-up" />;
  },
}));

describe("Account auth pages", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    clerkProps.signIn = [];
    clerkProps.signUp = [];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps broken social OAuth providers out of the production sign-in route", async () => {
    await act(async () => root.render(<SignInPage />));
    expect(clerkProps.signIn).toHaveLength(1);
    expect(clerkProps.signIn[0]).toMatchObject({ routing: "path", path: "/sign-in" });
    expect(clerkProps.signIn[0].appearance.elements.socialButtonsBlockButton).toEqual({ display: "none" });
    expect(clerkProps.signIn[0].appearance.elements.dividerRow).toEqual({ display: "none" });
  });

  it("keeps broken social OAuth providers out of the production sign-up route", async () => {
    await act(async () => root.render(<SignUpPage />));
    expect(clerkProps.signUp).toHaveLength(1);
    expect(clerkProps.signUp[0]).toMatchObject({ routing: "path", path: "/sign-up" });
    expect(clerkProps.signUp[0].appearance.elements.socialButtonsBlockButton).toEqual({ display: "none" });
    expect(clerkProps.signUp[0].appearance.elements.dividerRow).toEqual({ display: "none" });
  });
});

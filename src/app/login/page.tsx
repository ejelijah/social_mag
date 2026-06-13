import * as React from "react";
import SignInForm from "./sign-in-form";

export default function SignInPage() {
  return (
    <React.Suspense>
      <SignInForm />
    </React.Suspense>
  );
}


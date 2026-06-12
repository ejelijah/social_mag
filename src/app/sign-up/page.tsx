import * as React from "react";
import SignUpForm from "./sign-up-form";

export default function SignUpPage() {
  return (
    <React.Suspense>
      <SignUpForm />
    </React.Suspense>
  );
}


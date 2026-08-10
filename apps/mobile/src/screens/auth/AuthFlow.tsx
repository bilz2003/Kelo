import React, { useState } from "react";
import { LoginScreen } from "./LoginScreen";
import { RegisterScreen } from "./RegisterScreen";

type Screen = "login" | "register";

/**
 * Same local-flow-controller pattern as MyChargersFlow — nothing here
 * needs deep-linking, so a nested navigator would be more machinery than
 * the flow warrants.
 */
export function AuthFlow() {
  const [screen, setScreen] = useState<Screen>("login");

  if (screen === "register") {
    return <RegisterScreen onBack={() => setScreen("login")} />;
  }
  return <LoginScreen onNavigateToRegister={() => setScreen("register")} />;
}

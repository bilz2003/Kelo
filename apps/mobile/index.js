// expo/AppEntry.js hardcodes a relative `../../App` import assuming it's
// colocated two levels under the app's own node_modules. That assumption
// breaks under npm workspaces hoisting, where expo lives in the workspace
// root's node_modules instead — its `../../App` then resolves outside the
// repo entirely. This local entry point uses a relative import that's
// always correct, since it's colocated with App.tsx regardless of where
// node_modules ends up.
import { registerRootComponent } from "expo";
import App from "./App";

registerRootComponent(App);

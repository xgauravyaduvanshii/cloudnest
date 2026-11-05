import ApiKeys from "@/pages/apikeys";
import WebhooksPage from "@/pages/webhooks";
import { AUTH_ROUTES, PROTECTED_ROUTES } from "./routePath";
import SignIn from "@/pages/auth/sign-in";
import SignUp from "@/pages/auth/sign-up";
import Files from "@/pages/files";
import Overview from "@/pages/overview";
import Settings from "@/pages/settings";
import StorageAccounts from "@/pages/storage-accounts";
import Admin from "@/pages/admin";
import Collections from "@/pages/collections";
import Activity from "@/pages/activity";
import SupportPage from "@/pages/support";

export const authenticationRoutePaths = [
  { path: AUTH_ROUTES.SIGN_IN, element: <SignIn /> },
  { path: AUTH_ROUTES.SIGN_UP, element: <SignUp /> },
];

export const protectedRoutePaths = [
  { path: PROTECTED_ROUTES.OVERVIEW, element: <Overview /> },
  { path: PROTECTED_ROUTES.FILES, element: <Files /> },
  { path: PROTECTED_ROUTES.COLLECTIONS, element: <Collections /> },
  { path: PROTECTED_ROUTES.ACTIVITY, element: <Activity /> },
  { path: PROTECTED_ROUTES.STORAGE_ACCOUNTS, element: <StorageAccounts /> },
  { path: PROTECTED_ROUTES.APIKEYS, element: <ApiKeys /> },
  { path: PROTECTED_ROUTES.WEBHOOKS, element: <WebhooksPage /> },
  { path: PROTECTED_ROUTES.ADMIN, element: <Admin /> },
  { path: PROTECTED_ROUTES.SUPPORT, element: <SupportPage /> },
  {
    path: PROTECTED_ROUTES.SETTINGS,
    element: <Settings />,
  },
];

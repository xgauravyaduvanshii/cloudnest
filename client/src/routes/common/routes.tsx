import ApiKeys from "@/pages/apikeys";
import WebhooksPage from "@/pages/webhooks";
import { AUTH_ROUTES, PROTECTED_ROUTES } from "./routePath";
import SignIn from "@/pages/auth/sign-in";
import SignUp from "@/pages/auth/sign-up";
import VerifyEmail from "@/pages/auth/verify-email";
import ForgotPassword from "@/pages/auth/forgot-password";
import ResetPassword from "@/pages/auth/reset-password";
import MagicLink from "@/pages/auth/magic-link";
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
  { path: AUTH_ROUTES.VERIFY_EMAIL, element: <VerifyEmail /> },
  { path: AUTH_ROUTES.FORGOT_PASSWORD, element: <ForgotPassword /> },
  { path: AUTH_ROUTES.RESET_PASSWORD, element: <ResetPassword /> },
  { path: AUTH_ROUTES.MAGIC_LINK, element: <MagicLink /> },
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

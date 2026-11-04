import { BrowserRouter, Route, Routes } from "react-router-dom";
import { authenticationRoutePaths, protectedRoutePaths } from "./common/routes";
import AppLayout from "@/layouts/app-layout";
import BaseLayout from "@/layouts/base-layout";
import AuthRoute from "./authRoute";
import ProtectedRoute from "./protectedRoute";
import useAuthExpiration from "@/hooks/use-auth-expiration";
import Landing from "@/pages/landing";
import {
  AboutPage,
  AIPromptPage,
  ContactPage,
  HelpPage,
  PrivacyPolicyPage,
  SDKPage,
  SecurityPage,
  TermsPage,
} from "@/pages/public-pages";
import SharePage from "@/pages/share";
import Docs from "@/pages/docs";
import { PUBLIC_ROUTES } from "./common/routePath";

function AppRoutes() {
  useAuthExpiration();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path={PUBLIC_ROUTES.SDK} element={<SDKPage />} />
        <Route path={PUBLIC_ROUTES.AI_PROMPT} element={<AIPromptPage />} />
        <Route path={PUBLIC_ROUTES.PRIVACY} element={<PrivacyPolicyPage />} />
        <Route path={PUBLIC_ROUTES.TERMS} element={<TermsPage />} />
        <Route path={PUBLIC_ROUTES.HELP} element={<HelpPage />} />
        <Route path={PUBLIC_ROUTES.CONTACT} element={<ContactPage />} />
        <Route path={PUBLIC_ROUTES.SECURITY} element={<SecurityPage />} />
        <Route path={PUBLIC_ROUTES.ABOUT} element={<AboutPage />} />
        <Route path={PUBLIC_ROUTES.SHARE} element={<SharePage />} />
        <Route path={PUBLIC_ROUTES.DOCS} element={<Docs />} />
        <Route element={<AuthRoute />}>
          <Route element={<BaseLayout />}>
            {authenticationRoutePaths.map((route) => (
              <Route
                key={route.path}
                path={route.path}
                element={route.element}
              />
            ))}
          </Route>
        </Route>
        {/* Protected Route */}
        {/* Protected Route */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            {protectedRoutePaths.map((route) => {
              return (
                <Route
                  key={route.path}
                  path={route.path}
                  element={route.element}
                />
              );
            })}
          </Route>
        </Route>

        {/* Catch-all for undefined routes */}
        <Route path="*" element={<>404</>} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;

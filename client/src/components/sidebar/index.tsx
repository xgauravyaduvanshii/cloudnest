import { PROTECTED_ROUTES } from "@/routes/common/routePath";
import { NavLink, useLocation } from "react-router-dom";
import { Activity, Database, Folder, FolderKanban, HelpCircle, Home, Key, Shield, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTypedSelector } from "@/app/hook";

const SideBar = () => {
  const { pathname } = useLocation();
  const user = useTypedSelector((state) => state.auth.user);

  const routes = [
    {
      icon: Home,
      href: PROTECTED_ROUTES.OVERVIEW,
      label: "Overview",
    },
    {
      icon: Folder,
      href: PROTECTED_ROUTES.FILES,
      label: "Files",
    },
    {
      icon: FolderKanban,
      href: PROTECTED_ROUTES.COLLECTIONS,
      label: "Collections",
    },
    {
      icon: Activity,
      href: PROTECTED_ROUTES.ACTIVITY,
      label: "Activity",
    },
    {
      icon: Database,
      href: PROTECTED_ROUTES.STORAGE_ACCOUNTS,
      label: "Storage",
    },
    {
      icon: HelpCircle,
      href: PROTECTED_ROUTES.DOCS,
      label: "Docs",
    },
    {
      icon: Key,
      href: PROTECTED_ROUTES.APIKEYS,
      label: "Api Keys",
    },
    ...(user?.role === "ADMIN"
      ? [
          {
            icon: Shield,
            href: PROTECTED_ROUTES.ADMIN,
            label: "Admin",
          },
        ]
      : []),
    {
      icon: Settings,
      href: PROTECTED_ROUTES.SETTINGS,
      label: "Settings",
    },
  ];

  return (
    <div className="hidden lg:flex w-screen sticky shrink-0 top-20 flex-col sm:w-[215px] h-full">
      <nav>
        <ul
          className="flex flex-row justify-between gap-x-4 gap-y-2 p-4 
        text-center sm:flex-col sm:p-6 sm:text-left"
        >
          {routes.map((route, i) => {
            const Icon = route.icon;
            return (
              <li key={i}>
                <NavLink
                  className={cn(
                    "rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-secondary hover:!text-secondary-foreground flex h-max flex-col items-center justify-center gap-2 px-2 py-1.5 font-medium sm:h-10 sm:flex-row sm:justify-start sm:px-4 sm:text-sm bg-transparent text-foreground",
                    pathname === route.href && "bg-secondary"
                  )}
                  to={route.href}
                >
                  <Icon className="size-5" />
                  <span className="sr-only line-clamp-2 sm:not-sr-only">
                    {route.label}
                  </span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
};

export default SideBar;

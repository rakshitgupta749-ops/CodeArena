import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  LayoutDashboard,
  Users,
  FileText,
  Code2,
  LogOut,
  Settings,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";

const allNavItems = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/admin/candidates", icon: Users, label: "Users & Candidates" },
  { to: "/admin/batches", icon: Users, label: "Batches", adminOnly: true },
  { to: "/admin/assignments", icon: FileText, label: "Assignments" },
  { to: "/admin/reports", icon: FileText, label: "Reports" },
  { to: "/admin/problems", icon: Code2, label: "Problems" },
  { to: "/admin/settings", icon: Settings, label: "Global Settings", adminOnly: true },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Persistent collapsable state via localStorage
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem("sidebar_collapsed") === "true";
  });

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar_collapsed", String(next));
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navItems = allNavItems.filter((item) => !item.adminOnly || user?.role === "admin");

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside
        className={`border-r border-sidebar-border bg-sidebar flex flex-col fixed h-full z-30 transition-all duration-300 ease-in-out ${
          isCollapsed ? "w-[72px]" : "w-64"
        }`}
      >
        {/* Logo with interactive collapse/expand toggle */}
        <div
          className={`p-4 border-b border-sidebar-border flex items-center ${
            isCollapsed ? "justify-center" : "justify-start gap-3"
          }`}
        >
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleSidebar}
                className="p-2 rounded-xl bg-[oklch(0.58_0.18_145)] hover:bg-[oklch(0.52_0.18_145)] hover:shadow-lg active:scale-95 text-white shadow-md transition-all cursor-pointer flex items-center justify-center shrink-0 group focus:outline-none focus:ring-2 focus:ring-primary/50"
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                id="codearena-logo-btn"
              >
                <Code2 className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12} className="text-xs font-medium">
              {isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            </TooltipContent>
          </Tooltip>

          {!isCollapsed && (
            <div
              onClick={toggleSidebar}
              className="min-w-0 cursor-pointer select-none group"
              title="Click to collapse sidebar"
            >
              <span className="text-lg font-bold tracking-tight block truncate leading-tight group-hover:text-primary transition-colors">
                Code<span className="gradient-text">Arena</span>
              </span>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider truncate">
                {user?.role === "admin" ? "Admin Console" : "Faculty Portal"}
              </p>
            </div>
          )}
        </div>

        {/* Navigation items */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const navLink = (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center rounded-xl font-medium transition-all duration-200 group ${
                    isCollapsed
                      ? "justify-center p-2.5 h-11 w-11 mx-auto"
                      : "gap-3 px-3 py-2.5 text-sm"
                  } ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary shadow-xs font-semibold"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`
                }
                id={`nav-${item.label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
              >
                <item.icon className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            );

            if (isCollapsed) {
              return (
                <Tooltip key={item.to} delayDuration={150}>
                  <TooltipTrigger asChild>{navLink}</TooltipTrigger>
                  <TooltipContent side="right" sideOffset={12} className="text-xs font-medium">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return navLink;
          })}
        </nav>

        {/* User profile section */}
        <div className={`p-3 border-t border-sidebar-border ${isCollapsed ? "flex justify-center" : ""}`}>
          {isCollapsed ? (
            <Tooltip delayDuration={150}>
              <TooltipTrigger asChild>
                <Avatar className="h-9 w-9 cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all">
                  <AvatarFallback className="bg-[oklch(0.58_0.18_145)] text-white text-xs font-semibold">
                    {user?.name?.split(" ").map((n) => n[0]).join("") || "A"}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={12} className="text-xs space-y-0.5">
                <p className="font-semibold text-foreground">{user?.name}</p>
                <p className="text-[11px] text-muted-foreground">{user?.email}</p>
                <p className="text-[10px] text-primary uppercase font-bold mt-1">
                  {user?.role === "admin" ? "Administrator" : "Faculty Member"}
                </p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarFallback className="bg-[oklch(0.58_0.18_145)] text-white text-xs font-semibold">
                  {user?.name?.split(" ").map((n) => n[0]).join("") || "A"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium truncate">{user?.name}</p>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 ${
                      user?.role === "admin"
                        ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                        : "bg-purple-500/20 text-purple-600 dark:text-purple-400"
                    }`}
                  >
                    {user?.role === "admin" ? "Admin" : "Faculty"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main content area */}
      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${
          isCollapsed ? "ml-[72px]" : "ml-64"
        }`}
      >
        {/* Top bar */}
        <header className="sticky top-0 z-20 h-16 border-b border-border bg-background/80 backdrop-blur-md flex items-center justify-between px-6">
          {/* Left: Collapse toggle button */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="text-muted-foreground hover:text-foreground h-9 w-9 rounded-lg"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              id="topbar-toggle-sidebar"
            >
              {isCollapsed ? (
                <PanelLeft className="w-5 h-5 text-primary" />
              ) : (
                <PanelLeftClose className="w-5 h-5" />
              )}
            </Button>
            <span className="text-xs text-muted-foreground hidden sm:inline font-medium">
              {user?.role === "admin" ? "Administration Portal" : "Faculty Workspace"}
            </span>
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full" id="admin-user-menu">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-[oklch(0.58_0.18_145)] text-white text-xs">
                      {user?.name?.split(" ").map((n) => n[0]).join("") || "A"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6 animate-[fade-in_0.3s_ease-out]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

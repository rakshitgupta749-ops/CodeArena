import { useState } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Code2,
  LogOut,
  LayoutDashboard,
  Layers,
  FileCheck,
  ShieldCheck,
} from "lucide-react";
import { SystemReadinessModal } from "@/components/user/SystemReadinessModal";

export function UserLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [readinessModalOpen, setReadinessModalOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navItems = [
    {
      label: "My Dashboard",
      path: "/dashboard",
      icon: LayoutDashboard,
      isActive: location.pathname === "/" || location.pathname === "/dashboard",
    },
    {
      label: "My Assessments",
      path: "/assessments",
      icon: Layers,
      isActive:
        location.pathname.startsWith("/assessments") ||
        (location.pathname.startsWith("/problems") && !location.pathname.includes("/report")),
    },
    {
      label: "My Reports",
      path: "/reports",
      icon: FileCheck,
      isActive:
        location.pathname.startsWith("/reports") ||
        location.pathname.includes("/report"),
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 h-16 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="w-full h-full flex items-center justify-between px-4 sm:px-6">
          {/* Left: Logo + Navigation Tabs */}
          <div className="flex items-center gap-6 md:gap-8">
            {/* Logo */}
            <Link to="/dashboard" className="flex items-center gap-2.5 select-none shrink-0">
              <div className="p-1.5 rounded-lg bg-[oklch(0.58_0.18_145)] shadow-md">
                <Code2 className="w-4.5 h-4.5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold tracking-tight leading-none">
                  Code<span className="gradient-text">Arena</span>
                </span>
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">
                  Candidate Portal
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Tabs */}
            <nav className="hidden sm:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      item.isActive
                        ? "bg-primary/10 text-primary shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${item.isActive ? "text-primary" : "text-muted-foreground"}`} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* System Readiness Status Chip */}
            <button
              onClick={() => setReadinessModalOpen(true)}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/15 transition-colors cursor-pointer"
              title="Click to check your hardware & environment readiness"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>System Ready</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </button>

            <ThemeToggle />

            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="rounded-full flex items-center gap-2 pl-1 pr-2 h-9"
                  id="user-menu"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-[oklch(0.58_0.18_145)] text-white text-xs font-semibold">
                      {user?.name?.split(" ").map((n) => n[0]).join("") || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-semibold hidden md:inline">{user?.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-2.5 py-2">
                  <p className="text-xs font-semibold text-foreground">{user?.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
                  <div className="mt-1.5">
                    <Badge variant="secondary" className="text-[10px] font-medium px-1.5 py-0.2">
                      Role: Candidate
                    </Badge>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setReadinessModalOpen(true)}
                  className="text-xs cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 mr-2 text-emerald-500" />
                  System Diagnostics
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-xs text-destructive focus:text-destructive cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="sm:hidden flex items-center justify-around border-t border-border/50 bg-background/95 px-2 py-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-md text-[10px] font-medium transition-colors ${
                  item.isActive ? "text-primary font-bold" : "text-muted-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label.replace("My ", "")}
              </Link>
            );
          })}
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* System Readiness Modal */}
      <SystemReadinessModal
        open={readinessModalOpen}
        onOpenChange={setReadinessModalOpen}
      />
    </div>
  );
}

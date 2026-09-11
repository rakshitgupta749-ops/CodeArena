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
import { LayoutDashboard, Users, FileText, Code2, LogOut, Send, Activity, Settings, PieChart } from "lucide-react";

const allNavItems = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/admin/candidates", icon: Users, label: "Candidates" },
  { to: "/admin/batches", icon: Users, label: "Batches" },
  { to: "/admin/assignments", icon: FileText, label: "Assignments" },
  { to: "/admin/interviews", icon: Activity, label: "Interviews" },
  { to: "/admin/reports", icon: FileText, label: "Reports" },
  { to: "/admin/analytics", icon: PieChart, label: "Analytics" },
  { to: "/admin/problems", icon: Code2, label: "Problems (Admin)", adminOnly: true },
  { to: "/admin/submissions", icon: Send, label: "Submissions (Admin)", adminOnly: true },
  { to: "/admin/settings", icon: Settings, label: "Settings (Admin)", adminOnly: true },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navItems = allNavItems.filter(item => !item.adminOnly || user?.role === "admin");

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-sidebar-border bg-sidebar flex flex-col fixed h-full z-30">
        {/* Logo */}
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[oklch(0.58_0.18_145)] shadow-md">
              <Code2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              Code<span className="gradient-text">Arena</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 ml-[44px]">Admin & Faculty Panel</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary shadow-sm"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`
              }
              id={`nav-${item.label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
            >
              <item.icon className="w-4.5 h-4.5 transition-transform group-hover:scale-110" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-[oklch(0.58_0.18_145)] text-white text-xs font-semibold">
                {user?.name?.split(" ").map(n => n[0]).join("") || "A"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 ml-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 h-16 border-b border-border bg-background/80 backdrop-blur-md flex items-center justify-end px-6 gap-2">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full" id="admin-user-menu">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-[oklch(0.58_0.18_145)] text-white text-xs">
                    {user?.name?.split(" ").map(n => n[0]).join("") || "A"}
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
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page content */}
        <main className="p-6 animate-[fade-in_0.3s_ease-out]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

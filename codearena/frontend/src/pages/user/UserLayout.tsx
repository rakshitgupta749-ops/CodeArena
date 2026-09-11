import { Outlet, useNavigate } from "react-router-dom";
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
import { Code2, LogOut } from "lucide-react";

export function UserLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 h-16 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="w-full h-full flex items-center justify-between px-6">
          {/* Logo */}
          <div className="flex items-center gap-2.5 select-none">
            <div className="p-1.5 rounded-lg bg-[oklch(0.58_0.18_145)] shadow-md">
              <Code2 className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              Code<span className="gradient-text">Arena</span>
            </span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="rounded-full flex items-center gap-2 pl-0" id="user-menu">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-[oklch(0.58_0.18_145)] text-white text-xs font-semibold">
                      {user?.name?.split(" ").map(n => n[0]).join("") || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium hidden sm:inline">{user?.name}</span>
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
          </div>
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1 animate-[fade-in_0.3s_ease-out]">
        <Outlet />
      </main>
    </div>
  );
}

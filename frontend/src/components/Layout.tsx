import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import {
  LayoutDashboard,
  Upload,
  Library,
  Shield,
  LogOut,
  Menu,
  X,
  Wifi,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { usePermissions } from "../rbac";
import type { UserRole } from "../types";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: UserRole[];
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const { can, roleInfo } = usePermissions();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  const handleLogout = (): void => {
    logout();
    navigate("/login");
  };

  const navItems: NavItem[] = [
    {
      to: "/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      roles: ["admin", "editor", "viewer"],
    },
    {
      to: "/upload",
      label: "Upload",
      icon: Upload,
      roles: ["admin", "editor"],
    },
    {
      to: "/library",
      label: "Library",
      icon: Library,
      roles: ["admin", "editor", "viewer"],
    },
    { to: "/admin", label: "Admin", icon: Shield, roles: ["admin"] },
  ];

  const filteredNav = navItems.filter((item) =>
    item.roles.includes(user?.role as UserRole),
  );

  // Permission-aware helpers used in the sidebar
  const canUpload = can("video:upload");
  const isAdmin = can("admin:access");

  const linkClasses = ({ isActive }: { isActive: boolean }): string =>
    `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
      isActive
        ? "bg-primary-600 text-white shadow-md"
        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
    }`;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 flex flex-col transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
          <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 4l8 6-8 6V4z" fill="white" />
            </svg>
          </div>
          <span className="text-xl font-bold text-gray-900">TalentPulse</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {filteredNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={linkClasses}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User info & logout */}
        <div className="border-t border-gray-100 px-4 py-4">
          <div className="flex items-center gap-2 mb-2 px-2">
            {connected ? (
              <Wifi size={14} className="text-green-500" />
            ) : (
              <WifiOff size={14} className="text-red-400" />
            )}
            <span className="text-xs text-gray-400">
              {connected ? "Connected" : "Disconnected"}
            </span>
          </div>
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold text-sm">
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.name}
              </p>
              {roleInfo && (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${roleInfo.bgColor} ${roleInfo.color}`}
                >
                  {roleInfo.label}
                </span>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center gap-4 px-4 py-3 bg-white border-b border-gray-200">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <Menu size={22} />
          </button>
          <span className="font-bold text-gray-900">TalentPulse</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

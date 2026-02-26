/**
 * Unauthorized Page
 * Shown when a user tries to access a route they don't have permission for.
 */
import { useNavigate } from "react-router-dom";
import { ShieldOff } from "lucide-react";
import { usePermissions } from "../rbac";

export default function UnauthorizedPage() {
  const navigate = useNavigate();
  const { roleInfo } = usePermissions();

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldOff size={40} className="text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
        <p className="text-gray-500 mb-2">
          You don't have permission to access this page.
        </p>
        {roleInfo && (
          <p className="text-sm text-gray-400 mb-6">
            Your current role:{" "}
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${roleInfo.bgColor} ${roleInfo.color}`}
            >
              {roleInfo.label}
            </span>
            {" — "}
            {roleInfo.description}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigate("/dashboard")}
            className="px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
          >
            Go to Dashboard
          </button>
          <button
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}

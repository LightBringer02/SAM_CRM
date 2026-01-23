import { useAuth } from "../auth";

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-sky-700">Dashboard Overview</h1>

      {user && (
        <div className="bg-white rounded shadow p-3 border border-gray-200 flex items-center gap-4 max-w-xl">
          <span className="text-base font-semibold text-gray-900">Welcome, {user.name || user.username}!</span>
          <span className="text-xs text-gray-500 border-l pl-3 ml-3">{user.role}</span>
          {user.email && (
            <span className="text-xs text-gray-500 border-l pl-3 ml-3">{user.email}</span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
          <p className="text-blue-600 text-sm font-medium">Quick Stats</p>
          <p className="text-2xl font-bold text-blue-900 mt-2">Coming Soon</p>
        </div>
        <div className="bg-green-50 rounded-lg p-6 border border-green-200">
          <p className="text-green-600 text-sm font-medium">Analytics</p>
          <p className="text-2xl font-bold text-green-900 mt-2">Coming Soon</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-6 border border-purple-200">
          <p className="text-purple-600 text-sm font-medium">Reports</p>
          <p className="text-2xl font-bold text-purple-900 mt-2">Coming Soon</p>
        </div>
      </div>
    </div>
  );
}

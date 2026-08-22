import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get('hrms-token');

  if (!token) {
    redirect('/login');
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Suki HRMS Dashboard</h1>
      <p className="text-gray-600 mb-6">You are logged in.</p>
      <div className="grid grid-cols-2 gap-4">
        <Link href="/employees" className="bg-blue-50 border border-blue-200 rounded-lg p-4 hover:bg-blue-100 transition">
          <h2 className="font-semibold text-blue-900">Employee Master</h2>
          <p className="text-sm text-blue-700">Manage employee records</p>
        </Link>
        <Link href="/masters/departments" className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 hover:bg-indigo-100 transition">
          <h2 className="font-semibold text-indigo-900">Master Setup</h2>
          <p className="text-sm text-indigo-700">Manage master tables</p>
        </Link>
      </div>
      <form action="/api/auth/logout" method="POST" className="mt-6">
        <button type="submit" className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition">
          Logout
        </button>
      </form>
    </div>
  );
}

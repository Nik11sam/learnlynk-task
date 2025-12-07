import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';


interface Task {
  id: string;
  type: 'call' | 'email' | 'review';
  application_id: string;
  due_at: string;
  status: string;
}

export default function TodayPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get start and end of today in local timezone
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      const { data, error: fetchError } = await supabase
        .from('tasks')
        .select('id, type, application_id, due_at, status')
        .gte('due_at', startOfDay.toISOString())
        .lt('due_at', endOfDay.toISOString())
        .neq('status', 'completed')
        .order('due_at', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      setTasks(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleMarkComplete = async (taskId: string) => {
    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', taskId);

      if (updateError) {
        throw updateError;
      }

      // Refetch tasks after successful update
      await fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
    }
  };

  const formatDateTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">Today's Tasks</h1>
        <p>Loading tasks...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">Today's Tasks</h1>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Today's Tasks</h1>

      {tasks.length === 0 ? (
        <p className="text-gray-600">No tasks due today.</p>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      {task.type}
                    </span>
                    <span className="text-sm text-gray-500">
                      Due: {formatDateTime(task.due_at)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Application:</span>{' '}
                    {task.application_id}
                  </div>
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Status:</span> {task.status}
                  </div>
                </div>
                <button
                  onClick={() => handleMarkComplete(task.id)}
                  className="ml-4 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  Mark Complete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
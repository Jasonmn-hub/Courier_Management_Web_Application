import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))'];

export default function Charts() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['/api/stats'],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-6 bg-slate-200 rounded w-48 animate-pulse"></div>
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-slate-50 rounded-lg flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const pieData = [
    { name: 'On The Way', value: stats?.onTheWay || 0 },
    { name: 'Completed', value: stats?.completed || 0 },
  ];

  // Mock monthly data - in a real app, this would come from the API
  const monthlyData = [
    { month: 'Jan', onTheWay: 12, completed: 28 },
    { month: 'Feb', onTheWay: 19, completed: 35 },
    { month: 'Mar', onTheWay: 15, completed: 42 },
    { month: 'Apr', onTheWay: 22, completed: 38 },
    { month: 'May', onTheWay: 18, completed: 45 },
    { month: 'Jun', onTheWay: stats?.onTheWay || 0, completed: stats?.completed || 0 },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* Status Distribution Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Courier Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Trends Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Courier Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="onTheWay" 
                  stroke="hsl(var(--chart-1))" 
                  strokeWidth={2}
                  name="On The Way"
                />
                <Line 
                  type="monotone" 
                  dataKey="completed" 
                  stroke="hsl(var(--chart-2))" 
                  strokeWidth={2}
                  name="Completed"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

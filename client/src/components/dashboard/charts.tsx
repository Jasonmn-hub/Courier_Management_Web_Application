import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

export default function Charts() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['/api/stats'],
  });
  
  const { data: monthlyStats = [], isLoading: isMonthlyLoading } = useQuery<Array<{
    month: string;
    onTheWay: number;
    completed: number;
  }>>({ queryKey: ['/api/stats/monthly'] });

  if (isLoading || isMonthlyLoading) {
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

  // Ensure pie chart always shows data, even when all values are 0
  const onTheWayCount = (stats as any)?.onTheWay || 0;
  const completedCount = (stats as any)?.completed || 0;
  
  const pieData = onTheWayCount === 0 && completedCount === 0 
    ? [{ name: 'No Data', value: 1 }]
    : [
        { name: 'On The Way', value: onTheWayCount },
        { name: 'Completed', value: completedCount },
      ].filter(item => item.value > 0);

  // Use real monthly data from API
  const monthlyData = monthlyStats.length > 0 ? monthlyStats : [
    { month: 'No Data', onTheWay: 0, completed: 0 }
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
                  label={({ name, percent, value }) => {
                    if (name === 'No Data') return 'No Couriers';
                    return `${name} ${value} (${(percent * 100).toFixed(0)}%)`;
                  }}
                  outerRadius={90}
                  innerRadius={30}
                  fill="#8884d8"
                  dataKey="value"
                  stroke="#ffffff"
                  strokeWidth={2}
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
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis 
                  dataKey="month" 
                  stroke="#64748B"
                  fontSize={12}
                />
                <YAxis 
                  stroke="#64748B"
                  fontSize={12}
                />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="onTheWay" 
                  stroke="#F59E0B" 
                  strokeWidth={3}
                  name="On The Way"
                  dot={{ fill: '#F59E0B', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#F59E0B', strokeWidth: 2, fill: '#FBBF24' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="completed" 
                  stroke="#10B981" 
                  strokeWidth={3}
                  name="Completed"
                  dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#10B981', strokeWidth: 2, fill: '#34D399' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

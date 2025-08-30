import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar } from "recharts";

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

export default function Charts() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['/api/stats'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });
  
  const { data: monthlyStats = [], isLoading: isMonthlyLoading } = useQuery<Array<{
    month: string;
    onTheWay: number;
    completed: number;
    sent: number;
    received: number;
  }>>({ 
    queryKey: ['/api/stats/monthly'],
    refetchInterval: 15000, // Refresh every 15 seconds
  });

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

  // Prepare data for separate sent and received charts
  const sentData = [
    { name: 'On The Way', value: onTheWayCount },
    { name: 'Completed', value: (stats as any)?.sent ? (stats as any).sent - onTheWayCount : 0 }
  ].filter(item => item.value > 0);

  const receivedData = monthlyData.length > 0 ? monthlyData : [
    { month: 'No Data', received: 0 }
  ];

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* Sent Couriers Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Sent Couriers Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sentData.length > 0 ? sentData : [{ name: 'No Data', value: 1 }]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent, value }) => {
                    if (name === 'No Data') return 'No Sent Couriers';
                    return `${name} ${value} (${(percent * 100).toFixed(0)}%)`;
                  }}
                  outerRadius={90}
                  innerRadius={30}
                  fill="#8884d8"
                  dataKey="value"
                  stroke="#ffffff"
                  strokeWidth={2}
                >
                  {(sentData.length > 0 ? sentData : [{ name: 'No Data', value: 1 }]).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Received Couriers Chart (Column Chart) */}
      <Card>
        <CardHeader>
          <CardTitle>Received Couriers Monthly</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={receivedData}>
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
                <Bar 
                  dataKey="received" 
                  fill="#10B981" 
                  name="Received Couriers"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

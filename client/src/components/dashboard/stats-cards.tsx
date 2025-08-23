import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Package, Truck, CheckCircle, Calendar } from "lucide-react";

export default function StatsCards() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['/api/stats'],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <div className="animate-pulse">
                <div className="flex items-center">
                  <div className="h-8 w-8 bg-slate-200 rounded"></div>
                  <div className="ml-5 w-0 flex-1">
                    <div className="h-4 bg-slate-200 rounded w-24 mb-2"></div>
                    <div className="h-6 bg-slate-200 rounded w-16"></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statsData = [
    {
      name: "Total Couriers",
      value: stats?.total || 0,
      icon: Package,
      color: "text-slate-400",
      testId: "stat-total-couriers"
    },
    {
      name: "On The Way",
      value: stats?.onTheWay || 0,
      icon: Truck,
      color: "text-warning",
      testId: "stat-on-the-way"
    },
    {
      name: "Completed",
      value: stats?.completed || 0,
      icon: CheckCircle,
      color: "text-success",
      testId: "stat-completed"
    },
    {
      name: "This Month",
      value: stats?.thisMonth || 0,
      icon: Calendar,
      color: "text-primary",
      testId: "stat-this-month"
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {statsData.map((stat) => (
        <Card key={stat.name}>
          <CardContent className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <stat.icon className={`h-8 w-8 ${stat.color}`} />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-slate-500 truncate">
                    {stat.name}
                  </dt>
                  <dd 
                    className="text-lg font-semibold text-slate-900"
                    data-testid={stat.testId}
                  >
                    {stat.value}
                  </dd>
                </dl>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

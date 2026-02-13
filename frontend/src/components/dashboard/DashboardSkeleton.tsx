import React from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Skeleton } from '../ui/Skeleton';

const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Skeleton size="xl" width="lg" className="mb-2" />
          <Skeleton size="md" width="md" />
        </div>
        <Skeleton size="lg" width="sm" />
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, index) => (
          <Card key={index} variant="gradient">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <Skeleton size="sm" width="md" className="mb-2" />
                  <Skeleton size="2xl" width="sm" />
                </div>
                <Skeleton variant="circular" size="lg" />
              </div>
              <Skeleton size="sm" width="lg" className="mt-4" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts and Insights Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Cash Flow Chart Card */}
        <Card>
          <CardHeader>
            <Skeleton size="lg" width="md" className="mb-2" />
            <Skeleton size="sm" width="lg" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6 md:flex-row md:items-center">
              <div className="h-56 w-full md:w-1/2">
                <Skeleton variant="rectangular" className="h-full" />
              </div>
              <div className="space-y-3 md:w-1/2">
                {[...Array(3)].map((_, index) => (
                  <div key={index} className="rounded-lg bg-gray-50 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <Skeleton size="sm" width="sm" />
                      <Skeleton size="sm" width="xs" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Insights Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <Skeleton size="lg" width="sm" className="mb-2" />
                <Skeleton size="sm" width="md" />
              </div>
              <Skeleton size="sm" width="xs" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...Array(3)].map((_, index) => (
                <div key={index} className="border-l-4 border-gray-300 bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <Skeleton variant="circular" size="sm" />
                    <div className="flex-1">
                      <Skeleton size="sm" width="md" className="mb-2" />
                      <Skeleton size="sm" width="full" count={2} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions Card */}
      <Card>
        <CardHeader>
          <Skeleton size="lg" width="sm" className="mb-2" />
          <Skeleton size="sm" width="lg" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[...Array(3)].map((_, index) => (
              <Skeleton key={index} size="lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardSkeleton;
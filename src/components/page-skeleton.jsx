import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
export function DashboardSkeleton() {
    return (<div className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-8 w-48"/>
        <Skeleton className="mt-2 h-4 w-72"/>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (<Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <Skeleton className="h-4 w-24"/>
              <Skeleton className="size-4 rounded"/>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16"/>
              <Skeleton className="mt-2 h-3 w-32"/>
            </CardContent>
          </Card>))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <Skeleton className="h-5 w-32"/>
            <Skeleton className="h-4 w-56"/>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[280px] w-full rounded-md"/>
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <Skeleton className="h-5 w-36"/>
            <Skeleton className="h-4 w-48"/>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[280px] w-full rounded-md"/>
          </CardContent>
        </Card>
      </div>
    </div>);
}
export function TablePageSkeleton() {
    return (<div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Skeleton className="h-8 w-32"/>
          <Skeleton className="mt-2 h-4 w-64"/>
        </div>
        <Skeleton className="h-10 w-32 rounded-md"/>
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Skeleton className="h-10 flex-1"/>
            <Skeleton className="h-10 w-[140px]"/>
            <Skeleton className="h-10 w-[140px]"/>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col">
            <div className="flex items-center gap-4 border-b px-4 py-3">
              {Array.from({ length: 5 }).map((_, i) => (<Skeleton key={i} className="h-4 flex-1"/>))}
            </div>
            {Array.from({ length: 6 }).map((_, i) => (<div key={i} className="flex items-center gap-4 border-b px-4 py-4 last:border-b-0">
                <Skeleton className="h-4 flex-[2]"/>
                <Skeleton className="h-4 flex-1"/>
                <Skeleton className="h-6 w-20 rounded-full"/>
                <Skeleton className="h-6 w-16 rounded-full"/>
                <Skeleton className="size-8 rounded"/>
              </div>))}
          </div>
        </CardContent>
      </Card>
    </div>);
}
export function CardGridSkeleton() {
    return (<div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Skeleton className="h-8 w-32"/>
          <Skeleton className="mt-2 h-4 w-64"/>
        </div>
        <Skeleton className="h-10 w-32 rounded-md"/>
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Skeleton className="h-10 flex-1"/>
            <Skeleton className="h-10 w-[140px]"/>
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (<Card key={i}>
            <Skeleton className="aspect-[4/3] w-full rounded-t-xl"/>
            <CardContent className="pt-4">
              <Skeleton className="h-5 w-3/4"/>
              <Skeleton className="mt-2 h-3 w-full"/>
              <div className="mt-3 flex items-center justify-between">
                <Skeleton className="h-3 w-20"/>
                <Skeleton className="h-3 w-24"/>
              </div>
            </CardContent>
          </Card>))}
      </div>
    </div>);
}
export function ProfileCardsSkeleton() {
    return (<div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Skeleton className="h-8 w-48"/>
          <Skeleton className="mt-2 h-4 w-72"/>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (<Card key={i}>
            <CardContent className="flex items-center gap-3 pt-4">
              <Skeleton className="size-9 rounded-lg"/>
              <div>
                <Skeleton className="h-6 w-8"/>
                <Skeleton className="mt-1 h-3 w-16"/>
              </div>
            </CardContent>
          </Card>))}
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Skeleton className="h-10 flex-1"/>
            <Skeleton className="h-10 w-[140px]"/>
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (<Card key={i} className="overflow-hidden">
            <div className="flex gap-4 p-5">
              <Skeleton className="size-24 shrink-0 rounded-lg"/>
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-5 w-3/4"/>
                <Skeleton className="h-4 w-1/2"/>
                <Skeleton className="h-3 w-full"/>
                <Skeleton className="h-3 w-2/3"/>
              </div>
            </div>
            <div className="border-t px-5 py-3">
              <div className="flex gap-2">
                {Array.from({ length: 4 }).map((_, j) => (<Skeleton key={j} className="h-6 w-16 rounded-full"/>))}
              </div>
            </div>
          </Card>))}
      </div>
    </div>);
}
export function SettingsSkeleton() {
    return (<div className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-8 w-48"/>
        <Skeleton className="mt-2 h-4 w-64"/>
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40"/>
          <Skeleton className="h-4 w-56"/>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {Array.from({ length: 4 }).map((_, i) => (<div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-24"/>
              <Skeleton className="h-10 w-full"/>
            </div>))}
          <Skeleton className="mt-2 h-10 w-32"/>
        </CardContent>
      </Card>
    </div>);
}
export function MessagesSkeleton() {
    return (<div className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-8 w-48"/>
        <Skeleton className="mt-2 h-4 w-72"/>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (<Card key={i}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="size-4 rounded"/>
                  <Skeleton className="h-4 w-16"/>
                </div>
                <Skeleton className="h-8 w-8"/>
              </div>
            </CardContent>
          </Card>))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <Skeleton className="h-10 w-full"/>
          </CardHeader>
          <CardContent className="p-0">
            <div className="mx-4 mb-2">
              <Skeleton className="h-10 w-full rounded-lg"/>
            </div>
            <div className="flex flex-col">
              {Array.from({ length: 5 }).map((_, i) => (<div key={i} className="flex items-start gap-3 border-b p-4">
                  <Skeleton className="mt-1 size-2 rounded-full"/>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-24"/>
                      <Skeleton className="h-5 w-16 rounded-full"/>
                    </div>
                    <Skeleton className="mt-1 h-3 w-full"/>
                    <Skeleton className="mt-2 h-3 w-20"/>
                  </div>
                </div>))}
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardContent className="flex min-h-[400px] items-center justify-center pt-6">
            <div className="text-center">
              <Skeleton className="mx-auto size-12 rounded-lg"/>
              <Skeleton className="mx-auto mt-3 h-4 w-48"/>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>);
}

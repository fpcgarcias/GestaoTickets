import { Route, Redirect } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';
export function ProtectedRoute(_a) {
    var path = _a.path, Component = _a.component;
    var _b = useAuth(), user = _b.user, isLoading = _b.isLoading;
    if (isLoading) {
        return (<Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary"/>
        </div>
      </Route>);
    }
    return (<Route path={path}>
      {user ? <Component /> : <Redirect to="/auth"/>}
    </Route>);
}

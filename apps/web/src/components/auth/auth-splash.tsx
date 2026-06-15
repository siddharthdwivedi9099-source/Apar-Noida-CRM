import { platformMetadata } from "@crm/config";
import { Badge } from "@/components/ui/badge";

interface AuthSplashProps {
  title: string;
  description: string;
}

export function AuthSplash({ title, description }: AuthSplashProps) {
  return (
    <div className="min-h-screen bg-hero-glow px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl items-center justify-center">
        <div className="glass-panel w-full max-w-2xl rounded-[2rem] p-10 text-center">
          <Badge variant="success">Secure workspace</Badge>
          <p className="mt-6 text-sm uppercase tracking-[0.28em] text-muted-foreground">
            {platformMetadata.shortName}
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-tight">{title}</h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}

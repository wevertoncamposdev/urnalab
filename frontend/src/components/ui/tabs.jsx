import * as Primitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

export const Tabs = Primitive.Root;

export function TabsList({ className, ...props }) {
  return (
    <Primitive.List
      className={cn('flex items-center gap-1 overflow-x-auto border-b', className)}
      {...props}
    />
  );
}

// `icon`/`badge` são extras nossos (não fazem parte da API do Radix) — por isso
// saem do objeto antes de espalhar o resto das props no Trigger.
export function TabsTrigger({ className, children, icon: Icon, badge, ...props }) {
  return (
    <Primitive.Trigger
      className={cn(
        'group relative flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground',
        className,
      )}
      {...props}
    >
      {Icon && <Icon className="size-4" />}
      {children}
      {badge != null && (
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground transition-colors group-data-[state=active]:bg-primary/15 group-data-[state=active]:text-primary">
          {badge}
        </span>
      )}
      <span className="absolute inset-x-3 -bottom-px h-0.5 scale-x-0 rounded-full bg-primary transition-transform duration-200 group-data-[state=active]:scale-x-100" />
    </Primitive.Trigger>
  );
}

export function TabsContent({ className, ...props }) {
  return (
    <Primitive.Content
      className={cn(
        'outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring',
        className,
      )}
      {...props}
    />
  );
}

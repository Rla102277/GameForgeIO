import { useEffect, useRef } from "react";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { shadcn } from "@clerk/themes";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import ProjectWorkspace from "@/pages/project-workspace";
import FeedbackPage from "@/pages/feedback-page";
import ChangelogPage from "@/pages/changelog";

const queryClient = new QueryClient();

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  baseTheme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsPlacement: "bottom" as const,
  },
  variables: {
    colorPrimary: "#06b6d4",
    colorForeground: "#e4e4e7",
    colorMutedForeground: "#71717a",
    colorDanger: "#ef4444",
    colorBackground: "#09090b",
    colorInput: "#18181b",
    colorInputForeground: "#e4e4e7",
    colorNeutral: "#3f3f46",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    borderRadius: "0.375rem",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "bg-zinc-950 border border-zinc-900 rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl shadow-black/60",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-white font-bold",
    headerSubtitle: "text-zinc-500",
    socialButtonsBlockButtonText: "text-zinc-200 font-medium",
    formFieldLabel: "text-zinc-400 font-medium",
    footerActionLink: "text-cyan-400 hover:text-cyan-300 font-medium",
    footerActionText: "text-zinc-600",
    dividerText: "text-zinc-600",
    identityPreviewEditButton: "text-cyan-400",
    formFieldSuccessText: "text-emerald-400",
    alertText: "text-zinc-200",
    logoBox: "flex justify-center pt-2",
    logoImage: "h-10 w-10",
    socialButtonsBlockButton: "bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-white",
    formButtonPrimary: "bg-cyan-500 hover:bg-cyan-400 text-black font-semibold",
    formFieldInput: "bg-zinc-900 border-zinc-800 text-white",
    footerAction: "bg-zinc-900/50",
    dividerLine: "bg-zinc-800",
    alert: "bg-red-500/10 border-red-500/30",
    otpCodeFieldInput: "bg-zinc-900 border-zinc-800 text-white",
    formFieldRow: "",
    main: "",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
      />
    </div>
  );
}

function ProtectedWorkspace() {
  return (
    <>
      <Show when="signed-in">
        <ProjectWorkspace />
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function AppRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to your Board Game Factory",
          },
        },
        signUp: {
          start: {
            title: "Get started",
            subtitle: "Create your free Board Game Factory account",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ClerkQueryClientCacheInvalidator />
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route path="/projects/:id" component={ProtectedWorkspace} />
            <Route path="/feedback/:id" component={FeedbackPage} />
            <Route path="/changelog" component={ChangelogPage} />
            <Route component={NotFound} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <AppRoutes />
    </WouterRouter>
  );
}

export default App;

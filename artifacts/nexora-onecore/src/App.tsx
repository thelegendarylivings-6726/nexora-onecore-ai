import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, Show, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BadgeCheck, Blocks, Bot, BriefcaseBusiness,
  Building2, Check, ChevronDown, CircleHelp, Command, Compass, ExternalLink, Filter, Gauge,
  Layers3, LockKeyhole, LogOut, Menu, MessageSquareText, Plus, Search, Settings2, ShieldCheck,
  Sparkles, X, Zap,
} from 'lucide-react';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation, useRoute } from 'wouter';
import {
  getGetDashboardActivityQueryKey, getGetDashboardSummaryQueryKey, getGetPendingCommandApprovalsQueryKey, getGetWorkspaceQueryKey,
  getListBusinessesQueryKey, useActivateBusiness, useCreateDeploymentRequest,
  useDecideCommandApproval, useDeactivateBusiness, useGetDashboardActivity,
  useGetDashboardSummary, useGetPendingCommandApprovals, useGetWorkspace,
  useListBusinesses, useSubmitCommand,
} from '@workspace/api-client-react';
import type { ActivityItem, Business, CommandApproval, CommandStatus, DashboardSummary } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import './index.css';

const queryClient = new QueryClient();
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#1f6a56',
    colorForeground: '#1d2b38',
    colorMutedForeground: '#64737c',
    colorDanger: '#ae403c',
    colorBackground: '#fbf9f3',
    colorInput: '#ffffff',
    colorInputForeground: '#1d2b38',
    colorNeutral: '#d9e0df',
    fontFamily: 'Manrope, sans-serif',
    borderRadius: '0.7rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fbf9f3] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-[0_24px_70px_rgba(25,45,50,.12)]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#1d2b38] font-bold tracking-tight',
    headerSubtitle: 'text-[#64737c]',
    socialButtonsBlockButtonText: 'text-[#1d2b38] font-semibold',
    formFieldLabel: 'text-[#253844] font-semibold',
    footerActionLink: 'text-[#1f6a56] font-bold',
    footerActionText: 'text-[#64737c]',
    dividerText: 'text-[#64737c]',
    identityPreviewEditButton: 'text-[#1f6a56]',
    formFieldSuccessText: 'text-[#1f6a56]',
    alertText: 'text-[#8b3532]',
    logoBox: 'mb-2',
    logoImage: 'max-h-9',
    socialButtonsBlockButton: 'border-[#d9e0df] bg-white hover:bg-[#f2f4f0]',
    formButtonPrimary: 'bg-[#1f6a56] hover:bg-[#185744] text-white font-bold',
    formFieldInput: 'border-[#d9e0df] bg-white text-[#1d2b38]',
    footerAction: 'border-t border-[#e3e7e2]',
    dividerLine: 'bg-[#d9e0df]',
    alert: 'bg-[#fff1ee] border-[#edcbc5]',
    otpCodeFieldInput: 'border-[#d9e0df] bg-white',
    formFieldRow: 'gap-1',
    main: 'gap-4',
  },
};

function Brand({ light = false }: { light?: boolean }) {
  return <Link href="/" data-testid="link-brand" className={`inline-flex items-center gap-2.5 ${light ? 'text-[#f7f5ec]' : 'text-[#1d2b38]'}`}>
    <img src={`${basePath}/logo.svg`} alt="" className="h-8 w-8" />
    <span className="display text-[15px] font-bold tracking-[.12em]">NEXORA<span className="font-medium opacity-60"> ONECORE</span></span>
  </Link>;
}

function Button({ children, onClick, href, tone = 'solid', disabled = false, className = '', testId }: {
  children: ReactNode; onClick?: () => void; href?: string; tone?: 'solid' | 'outline' | 'quiet'; disabled?: boolean; className?: string; testId?: string;
}) {
  const base = `inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6a56]/50 ${tone === 'solid' ? 'bg-[#1f6a56] text-white hover:bg-[#185744] shadow-[0_4px_12px_rgba(31,106,86,.15)]' : tone === 'outline' ? 'border border-[#cad6d1] bg-white/70 text-[#1d2b38] hover:border-[#1f6a56] hover:text-[#1f6a56]' : 'text-[#52636c] hover:bg-[#eef1ec] hover:text-[#1d2b38]'} ${disabled ? 'pointer-events-none opacity-50' : ''} ${className}`;
  if (href) return <Link href={href} className={base} data-testid={testId}>{children}</Link>;
  return <button type="button" className={base} onClick={onClick} disabled={disabled} data-testid={testId}>{children}</button>;
}

function Header({ workspaceName }: { workspaceName?: string }) {
  const { isSignedIn } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const { signOut } = useClerk();
  return <header className="relative z-20 border-b border-[#dce2dc] bg-[#faf9f4]/95 backdrop-blur">
    <div className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between px-5 md:px-10">
      <Brand />
      <nav className="hidden items-center gap-4 md:flex xl:gap-5">
        <Link href="/catalog#catalog" className="text-[12px] font-semibold text-[#52636c] hover:text-[#1f6a56]">AI Businesses</Link>
        <Link href="/catalog#solutions" className="text-[12px] font-semibold text-[#52636c] hover:text-[#1f6a56]">Solutions</Link>
        <Link href="/catalog#workforce" className="text-[12px] font-semibold text-[#52636c] hover:text-[#1f6a56]">AI Workforce</Link>
        <Link href="/dashboard" className="text-[12px] font-semibold text-[#52636c] hover:text-[#1f6a56]">OneCore</Link>
        <Link href="/catalog#platform" aria-label="Demo availability: Phase 2" className="text-[12px] font-semibold text-[#52636c] hover:text-[#1f6a56]">Demo <span className="mono text-[8px] text-[#9a742d]">P2</span></Link>
        <Link href="/catalog#platform" aria-label="Pricing availability: Phase 6" className="text-[12px] font-semibold text-[#52636c] hover:text-[#1f6a56]">Pricing <span className="mono text-[8px] text-[#9a742d]">P6</span></Link>
      </nav>
      <div className="hidden items-center gap-3 md:flex">
        {isSignedIn ? <>
          <span className="mr-1 max-w-40 truncate text-[12px] text-[#728078]" data-testid="text-workspace">{workspaceName ?? 'Workspace'}</span>
          <Button href="/dashboard" tone="outline" className="px-3 py-2">Open workspace <ArrowRight size={14} /></Button>
          <button onClick={() => signOut({ redirectUrl: basePath || '/' })} className="rounded-lg p-2 text-[#64737c] hover:bg-[#edf0ea]" title="Sign out" data-testid="button-sign-out"><LogOut size={16} /></button>
        </> : <><Button href="/sign-in" tone="quiet" className="px-3">Sign in</Button><Button href="/sign-up" className="py-2.5">Create workspace <ArrowRight size={14} /></Button></>}
      </div>
      <button className="rounded-md p-2 text-[#1d2b38] md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu" data-testid="button-mobile-menu">{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
    </div>
    {menuOpen && <div className="absolute left-0 right-0 top-full border-b border-[#dce2dc] bg-[#faf9f4] px-5 py-4 shadow-lg md:hidden">
      <div className="flex flex-col gap-3">
        <Link onClick={() => setMenuOpen(false)} href="/catalog#catalog" className="py-2 text-sm font-semibold">AI Businesses</Link>
        <Link onClick={() => setMenuOpen(false)} href="/catalog#solutions" className="py-2 text-sm font-semibold">Solutions</Link>
        <Link onClick={() => setMenuOpen(false)} href="/catalog#workforce" className="py-2 text-sm font-semibold">AI Workforce</Link>
        <Link onClick={() => setMenuOpen(false)} href="/dashboard" className="py-2 text-sm font-semibold">OneCore</Link>
        <Link onClick={() => setMenuOpen(false)} href="/catalog#platform" className="py-2 text-sm font-semibold">Demo · Phase 2</Link>
        <Link onClick={() => setMenuOpen(false)} href="/catalog#platform" className="py-2 text-sm font-semibold">Pricing · Phase 6</Link>
        {isSignedIn ? <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="py-2 text-sm font-semibold">Command center</Link> : <><Link href="/sign-in" className="py-2 text-sm font-semibold">Sign in</Link><Button href="/sign-up">Create workspace <ArrowRight size={14} /></Button></>}
      </div>
    </div>}
  </header>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) client.clear();
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, client]);
  return null;
}

function SignInPage() {
  return <div className="auth-wall flex min-h-[100dvh] items-center justify-center px-4 py-10"><div className="pointer-events-none fixed inset-0 opacity-50" /><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div>;
}
function SignUpPage() {
  return <div className="auth-wall flex min-h-[100dvh] items-center justify-center px-4 py-10"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div>;
}

function HomeRedirect() {
  return <><Show when="signed-in"><Redirect to="/dashboard" /></Show><Show when="signed-out"><Home /></Show></>;
}

function Home() {
  const [location] = useLocation();
  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('');
  const [functionFilter, setFunctionFilter] = useState('');
  const params = {
    search: search || undefined,
    industry: industry || undefined,
    function: functionFilter || undefined,
  };
  const { data: businesses, isLoading, isError, refetch } = useListBusinesses(
    params,
    { query: { queryKey: getListBusinessesQueryKey(params) } },
  );
  const allCatalog = useListBusinesses();
  const filterSource = allCatalog.data ?? businesses ?? [];
  const industries = [...new Set(filterSource.map((b) => b.industry))].sort();
  const functions = [...new Set(filterSource.map((b) => b.function))].sort();
  const orderedBusinesses = [...(businesses ?? [])].sort(
    (a, b) => Number(b.phase === 'flagship') - Number(a.phase === 'flagship'),
  );
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(hash)?.scrollIntoView({ block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location]);
  return <div className="grain min-h-[100dvh] overflow-hidden">
    <Header />
    <main>
      <section className="relative mx-auto grid max-w-[1440px] items-center gap-12 px-5 pb-20 pt-16 md:grid-cols-[1.03fr_.97fr] md:px-10 md:pb-28 md:pt-24">
        <div className="relative z-10 enter">
          <div className="mono mb-6 inline-flex items-center gap-2 rounded-full border border-[#d5dfd7] bg-white/65 px-3 py-1.5 text-[10px] uppercase tracking-[.14em] text-[#356f5e]"><span className="h-1.5 w-1.5 rounded-full bg-[#d89b35]" /> NEXORA ONECORE AI</div>
          <h1 className="display max-w-[720px] text-[clamp(3.2rem,7.6vw,6.65rem)] font-semibold leading-[.94] tracking-[-.065em] text-[#172934]">50 AI Businesses.<br /><span className="text-[#24715b]">One Intelligent</span><br />Platform.</h1>
          <p className="mt-7 max-w-[560px] text-[16px] leading-7 text-[#56676f] md:text-[18px]">Deploy specialized AI agents across sales, marketing, customer service, operations, finance, logistics, real estate, healthcare administration, education and enterprise workflows from one platform.</p>
      <div className="mt-8 flex flex-wrap gap-3"><Button href="/catalog#catalog">Explore 50 AI Businesses <ArrowDownRight size={15} /></Button><Button href="/dashboard" tone="outline">Launch OneCore <span className="mono text-[9px] text-[#9a742d]">AI drafts</span></Button><Button href="/catalog#platform" tone="quiet">View Demo <span className="mono text-[9px] text-[#9a742d]">Phase 2</span></Button></div>
          <div className="mt-10 flex items-center gap-6 border-t border-[#dce2dc] pt-5">
            <div><p className="display text-2xl font-semibold tracking-tight">50</p><p className="mono text-[9px] uppercase tracking-[.14em] text-[#758078]">Business modules</p></div>
            <div className="h-9 w-px bg-[#dce2dc]" />
            <div><p className="display text-2xl font-semibold tracking-tight">01</p><p className="mono text-[9px] uppercase tracking-[.14em] text-[#758078]">Shared workspace</p></div>
            <div className="h-9 w-px bg-[#dce2dc]" />
            <div><p className="display text-2xl font-semibold tracking-tight">Live</p><p className="mono text-[9px] uppercase tracking-[.14em] text-[#758078]">Catalog browsing</p></div>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-[590px] enter-delay">
          <div className="absolute -right-12 -top-10 h-72 w-72 rounded-full bg-[#e6b04e]/20 blur-3xl" />
          <div className="relative rounded-[22px] border border-[#cdd8d2] bg-[#eff1e9] p-3 shadow-[0_30px_80px_rgba(24,55,49,.13)]">
            <div className="flex items-center justify-between rounded-t-[14px] bg-[#1d3038] px-5 py-4 text-[#f4f3eb]">
              <div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#d9a545] text-[#1d3038]"><Command size={15} /></div><span className="display text-[12px] font-semibold tracking-wide">ONECORE / SYSTEM VIEW</span></div><span className="mono text-[9px] text-[#9eb0a9]">PUBLIC PREVIEW</span>
            </div>
            <div className="rounded-b-[14px] bg-[#f9f8f2] p-5 md:p-6">
              <div className="mb-5 flex items-center justify-between"><div><p className="mono text-[9px] uppercase tracking-[.14em] text-[#8a928b]">WORKSPACE MAP</p><p className="display mt-1 text-xl font-semibold">A coordinated system</p></div><div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#dbe0d6] text-[#1f6a56]"><Layers3 size={17} /></div></div>
              <div className="grid grid-cols-[1fr_48px_1fr] items-center gap-2">
                <div className="space-y-2">
                  {['Revenue operations', 'People & talent', 'Customer experience'].map((label, i) => <div key={label} className="flex items-center gap-2 rounded-lg border border-[#dde2da] bg-white px-3 py-3"><span className={`flex h-7 w-7 items-center justify-center rounded-md ${i === 1 ? 'bg-[#f7ebce] text-[#98701e]' : 'bg-[#e7f0e9] text-[#2e715c]'}`}><BriefcaseBusiness size={14} /></span><span className="text-[10px] font-bold text-[#34444d]">{label}</span></div>)}
                </div>
                <div className="flex flex-col items-center gap-2 text-[#b08a42]"><span className="h-px w-full bg-[#d9c292]" /><div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#ddc890] bg-[#fbf4e1]"><Zap size={19} /></div><span className="h-px w-full bg-[#d9c292]" /></div>
                <div className="rounded-xl border border-[#2e705d] bg-[#1f6a56] p-4 text-white shadow-[0_12px_30px_rgba(31,106,86,.2)]">
                  <div className="mb-4 flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15"><Bot size={17} /></div><span className="display text-[11px] font-bold tracking-wide">ONECORE</span></div>
                  <div className="space-y-2"><div className="h-1.5 w-full rounded bg-white/25" /><div className="h-1.5 w-4/5 rounded bg-white/25" /><div className="mt-4 flex items-center gap-1.5 text-[9px] text-[#d2e8d8]"><span className="h-1.5 w-1.5 rounded-full bg-[#e3b24b]" /> AI drafts · admin review</div></div>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-[#e2e5dd] pt-4"><span className="mono text-[9px] uppercase tracking-[.12em] text-[#78837c]">Browse now · enable modules after sign-in</span><ArrowRight size={15} className="text-[#1f6a56]" /></div>
            </div>
          </div>
          <div className="absolute -bottom-6 -left-5 rounded-xl border border-[#d9dfd5] bg-white px-4 py-3 shadow-lg"><p className="mono text-[9px] uppercase tracking-[.14em] text-[#879088]">AVAILABILITY</p><p className="mt-1 flex items-center gap-2 text-[12px] font-bold text-[#1d2b38]"><span className="h-2 w-2 rounded-full bg-[#d9a545]" /> Catalog is live</p></div>
        </div>
      </section>

      <section id="platform" className="border-y border-[#243943] bg-[#1c3038] text-[#f3f2e9]">
        <div className="mx-auto grid max-w-[1440px] gap-8 px-5 py-9 md:grid-cols-[1fr_2fr] md:items-center md:px-10">
          <div><p className="mono text-[9px] uppercase tracking-[.18em] text-[#b9a26d]">PRODUCT AVAILABILITY</p><h2 className="display mt-2 text-2xl font-semibold">Clear by design. No implied capabilities.</h2></div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Availability phase="Live now" title="Catalog browsing" text="Browse all 50 modules and their published details." active />
            <Availability phase="Live now" title="Flagship AI workflows" text="Five flagship modules provide interactive, review-gated AI workflows." active />
            <Availability phase="Review-gated" title="OneCore commands" text="AI drafts require a configured integration. Proposed actions need owner or administrator review; external execution is not available." />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 py-14 md:px-10 md:py-20" id="business-showcase">
        <div className="mb-7 flex items-end justify-between gap-4"><div><p className="mono text-[10px] uppercase tracking-[.18em] text-[#a37b36]">10 BUSINESS WORLDS</p><h2 className="display mt-2 text-4xl font-semibold tracking-[-.04em]">Explore OneCore by business outcome.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-[#637078]">Swipe through ten focused business worlds instead of scanning fifty names at once. Each world brings five related AI modules together.</p></div><span className="hidden text-[11px] font-bold text-[#24715b] md:block">Swipe →</span></div>
        <div className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 md:-mx-10 md:px-10" data-testid="business-world-slider">
          {[
            ['Sales & Revenue','Turn interest into qualified opportunities',['AI Sales Agent','AI Lead Generation & Prospecting','AI Email Outreach & Follow-up','AI CRM Automation','AI Appointment Booking Agent']],
            ['Marketing & Growth','Create demand and keep campaigns moving',['AI Marketing Automation','AI SEO Optimization','AI Social-Media Management','AI Content & Creative Studio','AI Video/Ad Creative Generation']],
            ['Customer Experience','Respond faster without losing the human handoff',['AI Customer Support Agent','AI E-commerce Sales Agent','AI Abandoned-Cart Recovery','AI Hotel Booking & Guest Support','AI Restaurant Ordering & Reservations']],
            ['Property & Services','Coordinate leads, properties and field work',['AI Real-Estate Lead & Sales Agent','AI Property Management','AI Construction Operations','AI Field-Service Management','AI Home-Service Booking']],
            ['Logistics & Supply','Move orders, fleets and inventory with clarity',['AI Logistics & Dispatch','AI Freight Quote Automation','AI Warehouse & Fulfilment','AI Supply-Chain Optimization','AI Fleet Management']],
            ['Commerce & Operations','Connect procurement, inventory and daily execution',['AI Procurement Agent','AI Inventory Management','AI Manufacturing Operations','AI Predictive Maintenance','AI Automotive Service Agent']],
            ['People & Learning','Support teams, hiring and learning journeys',['AI Recruitment & HR Operations','AI Employee Helpdesk','AI Education Tutor','AI Kids Learning & Revision','AI Corporate Training']],
            ['Finance & Admin','Reduce repetitive back-office work with review gates',['AI Accounting & Invoice Automation','AI Finance Operations','AI Insurance Operations','AI Legal Document Workflow','AI Healthcare Administration']],
            ['Digital & IT','Build, understand and support digital operations',['AI Website/App Builder','AI Cybersecurity Operations','AI IT Helpdesk','AI Data Analytics & BI Agent','AI Clinic Front Desk']],
            ['OneCore Enterprise','Orchestrate work across the whole organization',['AI Enterprise Workflow Automation','AI Multi-Agent Workforce','AI Business Operating System / OneCore Command Center','AI Travel Planning & Booking','AI Medical Documentation Assistant']],
          ].map(([title, tagline, items], index) => <article key={String(title)} className="min-w-[86%] snap-center rounded-2xl border border-[#d5ddd5] bg-[#fffefa] p-6 shadow-[0_18px_45px_rgba(29,58,48,.06)] sm:min-w-[58%] lg:min-w-[38%]">
            <div className="flex items-center justify-between"><span className="mono text-[9px] uppercase tracking-[.16em] text-[#a37b36]">WORLD {String(index + 1).padStart(2,'0')}</span><ArrowUpRight size={17} className="text-[#24715b]" /></div><h3 className="display mt-5 text-2xl font-semibold">{String(title)}</h3><p className="mt-2 min-h-10 text-[12px] leading-5 text-[#69767b]">{String(tagline)}</p><div className="mt-5 space-y-2">{(items as string[]).map((item) => <div key={item} className="flex items-center gap-2 rounded-lg border border-[#e3e7df] bg-[#f7f8f3] px-3 py-2 text-[11px] font-semibold text-[#33474d]"><span className="h-1.5 w-1.5 rounded-full bg-[#2d7b63]" />{item}</div>)}</div><button onClick={() => { setSearch(String(title).split(' ')[0]); document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' }); }} className="mt-5 text-[11px] font-bold text-[#1f6a56]">Explore related modules <ArrowRight className="ml-1 inline" size={13} /></button>
          </article>)}
        </div>
      </section>
      <section className="border-y border-[#d9e0d8] bg-[#e9ece4]"><div className="mx-auto max-w-[1440px] px-5 py-14 md:px-10 md:py-18"><p className="mono text-[10px] uppercase tracking-[.18em] text-[#a37b36]">CHOOSE YOUR GOAL</p><h2 className="display mt-2 text-3xl font-semibold tracking-[-.04em]">Start with the result you want.</h2><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[
        ['Get more sales','Sales'],['Grow marketing','Marketing'],['Reduce support load','Support'],['Run operations','Operations'],['Move goods faster','Logistics']
      ].map(([label, term]) => <button key={label} onClick={() => { setSearch(term); document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' }); }} className="group rounded-xl border border-[#d3dbd2] bg-[#f9faf5] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#78a18f] hover:bg-white"><Sparkles size={16} className="text-[#24715b]" /><p className="mt-5 text-[13px] font-bold">{label}</p><p className="mt-1 text-[10px] text-[#718078]">Show matching AI businesses</p><ArrowRight size={14} className="mt-4 text-[#24715b] transition-transform group-hover:translate-x-1" /></button>)}</div></div></section>
      <section id="catalog" className="mx-auto max-w-[1440px] px-5 py-16 md:px-10 md:py-24">
        <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div><p className="mono text-[10px] uppercase tracking-[.18em] text-[#a37b36]">THE ONECORE CATALOG</p><h2 className="display mt-2 text-4xl font-semibold tracking-[-.04em] md:text-5xl">Select the work.<br className="hidden md:block" /> Not another app.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-[#637078]">Fifty separately configured business modules, with their own function, capabilities and workflow definition. Only browsing is live for the full catalog.</p></div>
          <div className="mono text-[10px] uppercase tracking-[.14em] text-[#758078]">01 / CATALOG INDEX</div>
        </div>
        <div className="mb-7 flex flex-col gap-3 rounded-xl border border-[#dce2dc] bg-white/65 p-3 sm:flex-row">
          <label className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#78857c]" size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search module, function or capability" className="h-11 w-full rounded-lg border border-[#e0e4dc] bg-[#fafaf6] pl-10 pr-3 text-sm outline-none focus:border-[#478371]" data-testid="input-catalog-search" /></label>
          <label className="relative sm:w-56"><Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-[#78857c]" size={15} /><select value={industry} onChange={(e) => setIndustry(e.target.value)} className="h-11 w-full appearance-none rounded-lg border border-[#e0e4dc] bg-[#fafaf6] pl-10 pr-8 text-sm text-[#34444d] outline-none focus:border-[#478371]" data-testid="select-industry"><option value="">All industries</option>{industries.map((item) => <option value={item} key={item}>{item}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#78857c]" size={15} /></label>
          <label className="relative sm:w-56"><Blocks className="absolute left-3 top-1/2 -translate-y-1/2 text-[#78857c]" size={15} /><select value={functionFilter} onChange={(e) => setFunctionFilter(e.target.value)} className="h-11 w-full appearance-none rounded-lg border border-[#e0e4dc] bg-[#fafaf6] pl-10 pr-8 text-sm text-[#34444d] outline-none focus:border-[#478371]" data-testid="select-business-function"><option value="">All functions</option>{functions.map((item) => <option value={item} key={item}>{item}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#78857c]" size={15} /></label>
        </div>
        {isLoading ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[1,2,3,4,5,6].map((i) => <div key={i} className="h-52 animate-pulse rounded-xl border border-[#dce2dc] bg-white/70 p-5"><div className="h-4 w-1/3 rounded bg-[#e7ebe5]" /><div className="mt-5 h-5 w-2/3 rounded bg-[#e7ebe5]" /><div className="mt-3 h-3 w-full rounded bg-[#edf0eb]" /><div className="mt-2 h-3 w-4/5 rounded bg-[#edf0eb]" /></div>)}</div>
        : isError ? <div className="rounded-xl border border-[#e6c7c2] bg-[#fff7f4] p-8 text-center"><CircleHelp className="mx-auto text-[#a94c42]" /><p className="mt-3 font-bold">The catalog could not load.</p><p className="mt-1 text-sm text-[#67747b]">Your search is still here. Try loading the catalog again.</p><Button onClick={() => refetch()} className="mt-4">Retry catalog</Button></div>
        : !businesses?.length ? <div className="rounded-xl border border-dashed border-[#cbd6cf] bg-white/55 p-12 text-center"><Search className="mx-auto text-[#829087]" /><p className="mt-3 font-bold">No modules match those filters.</p><button onClick={() => { setSearch(''); setIndustry(''); setFunctionFilter(''); }} className="mt-2 text-sm font-bold text-[#1f6a56]" data-testid="button-clear-filters">Clear filters</button></div>
        : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="list-business-modules">
          {orderedBusinesses.map((business, i) => <BusinessCard key={business.slug} business={business} index={businesses?.findIndex((entry) => entry.slug === business.slug) ?? i} />)}
        </div>}
        <div className="mt-6 flex items-center justify-between border-t border-[#dce2dc] pt-4"><span className="mono text-[10px] uppercase tracking-[.13em] text-[#79857d]" data-testid="text-catalog-count">{businesses?.length ?? 0} modules shown</span><span className="text-[11px] text-[#8a928b]">Five flagship AI workflows are interactive; remaining modules reflect catalog configuration.</span></div>
      </section>
      <section id="solutions" className="bg-[#e9ece4]">
        <div className="mx-auto grid max-w-[1440px] gap-8 px-5 py-14 md:grid-cols-[1fr_1.15fr] md:items-center md:px-10 md:py-20">
          <div id="workforce"><p className="mono text-[10px] uppercase tracking-[.17em] text-[#a37b36]">A SINGLE CONTROL SURFACE</p><h2 className="display mt-3 text-4xl font-semibold tracking-[-.045em]">Built for the people<br />who run the business.</h2></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ValueBlock icon={<Gauge size={17} />} title="One operating view" text="A workspace-level view of enabled modules and persisted operational metrics." />
            <ValueBlock icon={<ShieldCheck size={17} />} title="Role-aware access" text="Workspace roles shape navigation. API authorization remains the source of truth." />
            <ValueBlock icon={<Blocks size={17} />} title="Modules, not silos" text="Browse a connected catalog without pretending every module is already deployed." />
            <ValueBlock icon={<MessageSquareText size={17} />} title="Honest readiness" text="Phases are visible upfront—so teams know what's available before they plan." />
          </div>
        </div>
      </section>
      <footer className="bg-[#1c3038] px-5 py-8 text-[#d9e0d9] md:px-10"><div className="mx-auto flex max-w-[1440px] flex-col gap-5 md:flex-row md:items-center md:justify-between"><Brand light /><span className="mono text-[9px] uppercase tracking-[.16em] text-[#a9b5ae]">NEXORA ONECORE AI · Catalog browsing live · Other capabilities phased</span><Link href="/sign-up" className="text-sm font-bold text-[#e2ba67]">Enter the workspace <ArrowRight className="ml-1 inline" size={14} /></Link></div></footer>
    </main>
  </div>;
}

function Availability({ phase, title, text, active = false }: { phase: string; title: string; text: string; active?: boolean }) {
  return <div className={`rounded-lg border p-3 ${active ? 'border-[#558975]/70 bg-[#294c45]' : 'border-white/10 bg-white/[.035]'}`}><p className={`mono text-[9px] uppercase tracking-[.12em] ${active ? 'text-[#e2ba67]' : 'text-[#aab6b1]'}`}>{phase}</p><p className="mt-1 text-[12px] font-bold">{title}</p><p className="mt-1 text-[10px] leading-4 text-[#b4c0ba]">{text}</p></div>;
}
function ValueBlock({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <div className="rounded-xl border border-[#d6ddd4] bg-[#f7f7f1] p-4"><div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-[#e4eee6] text-[#24715b]">{icon}</div><h3 className="text-[13px] font-bold">{title}</h3><p className="mt-1 text-[11px] leading-5 text-[#647078]">{text}</p></div>;
}
function BusinessCard({ business, index }: { business: Business; index: number }) {
  return <Link href={`/business/${business.slug}`} className="group relative flex min-h-[224px] flex-col rounded-xl border border-[#dce2dc] bg-[#fffefa] p-5 transition-all duration-200 hover:-translate-y-1 hover:border-[#9db9a9] hover:shadow-[0_16px_36px_rgba(29,58,48,.09)]" data-testid={`card-business-${business.slug}`}>
    <div className="mb-5 flex items-center justify-between"><div className={`flex h-9 w-9 items-center justify-center rounded-lg ${business.phase === 'flagship' ? 'bg-[#f6ebcf] text-[#94691f]' : 'bg-[#e8eee7] text-[#386c5b]'}`}><BriefcaseBusiness size={17} /></div><span className={`mono rounded-full px-2 py-1 text-[8px] uppercase tracking-[.12em] ${business.phase === 'flagship' ? 'bg-[#f7eed8] text-[#8c692b]' : 'bg-[#eef1ec] text-[#707e75]'}`}>{business.phase === 'flagship' ? 'Flagship · Interactive AI' : `Module ${String(index + 1).padStart(2, '0')}`}</span></div>
    <h3 className="display text-[18px] font-semibold tracking-[-.025em] text-[#21323b]">{business.name}</h3>
    <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-[#67747a]">{business.description}</p>
    <div className="mt-auto flex items-end justify-between pt-5"><div><p className="mono text-[8px] uppercase tracking-[.12em] text-[#90988f]">{business.industry}</p><p className="mt-1 text-[10px] font-semibold text-[#46565d]">{business.function}</p></div><span className="flex items-center gap-1 text-[11px] font-bold text-[#236b57]">Details <ArrowUpRight className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" size={14} /></span></div>
  </Link>;
}

function SignInPrompt({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-2xl border border-[#d9e0d9] bg-white p-8 text-center shadow-sm"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8eee7] text-[#246b56]"><LockKeyhole size={20} /></div><h2 className="display mt-4 text-2xl font-semibold">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#68757a]">{detail}</p><div className="mt-6 flex justify-center gap-3"><Button href="/sign-in" tone="outline">Sign in</Button><Button href="/sign-up">Create workspace</Button></div></div>;
}

function SignedGate({ children, title = 'Your workspace is private', detail = 'Sign in to access your organization’s OneCore workspace.' }: { children: ReactNode; title?: string; detail?: string }) {
  return <><Show when="signed-in">{children}</Show><Show when="signed-out"><div className="mx-auto max-w-[700px] px-5 py-20"><SignInPrompt title={title} detail={detail} /></div></Show></>;
}

function WorkspaceLayout({ children, active }: { children: ReactNode; active: string }) {
  const { data: workspace } = useGetWorkspace({ query: { queryKey: getGetWorkspaceQueryKey(), retry: false } });
  const { signOut } = useClerk();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navItems = [
    { href: '/dashboard', label: 'Overview', icon: <Gauge size={17} /> },
    { href: '/catalog#catalog', label: 'Business catalog', icon: <Blocks size={17} /> },
    ...(workspace?.role === 'owner' || workspace?.role === 'admin' ? [{ href: '/admin', label: 'Organization', icon: <Settings2 size={17} /> }] : []),
  ];
  return <div className="min-h-[100dvh] bg-[#f3f3ed] md:flex">
    <aside className="hidden w-[250px] shrink-0 flex-col bg-[#1c3038] px-4 py-5 text-[#edf0e9] md:flex">
      <Brand light />
      <div className="mt-9 rounded-lg border border-white/10 bg-white/[.04] px-3 py-3"><p className="mono text-[8px] uppercase tracking-[.15em] text-[#98aaa2]">ACTIVE WORKSPACE</p><p className="mt-1 truncate text-[12px] font-bold">{workspace?.name ?? 'Workspace'}</p><p className="mt-1 text-[10px] capitalize text-[#aab6b1]">{workspace?.role ?? 'Loading role'}</p></div>
      <p className="mono mb-2 mt-8 px-2 text-[9px] uppercase tracking-[.14em] text-[#80958c]">OPERATE</p>
      <nav className="space-y-1">{navItems.map((item) => <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] font-semibold transition-colors ${active === item.label ? 'bg-[#2c4d47] text-[#f1d28a]' : 'text-[#c0cbc5] hover:bg-white/[.06] hover:text-white'}`} data-testid={`nav-${item.label.toLowerCase().replaceAll(' ', '-')}`}>{item.icon}{item.label}</Link>)}</nav>
      <div className="mt-auto rounded-lg border border-[#526e66]/55 bg-[#27443f] p-3"><p className="flex items-center gap-2 text-[11px] font-bold text-[#efdcab]"><Sparkles size={14} /> Runtime readiness</p><p className="mt-2 text-[10px] leading-4 text-[#c2d0c7]">Catalog live · AI drafts review-gated · workflows phased</p></div>
      <button onClick={() => signOut({ redirectUrl: basePath || '/' })} className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-left text-[11px] text-[#b2c0ba] hover:bg-white/[.06]" data-testid="button-workspace-sign-out"><LogOut size={15} /> Sign out</button>
    </aside>
    <div className="min-w-0 flex-1">
      <div className="flex h-[62px] items-center justify-between border-b border-[#dbe0d9] bg-[#faf9f4] px-5 md:px-9">
        <div className="flex items-center gap-2 md:hidden"><button type="button" onClick={() => setMobileMenuOpen((open) => !open)} aria-label={mobileMenuOpen ? 'Close workspace menu' : 'Open workspace menu'} aria-expanded={mobileMenuOpen} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#dce2dc] bg-white text-[#40544c]">{mobileMenuOpen ? <X size={17} /> : <Menu size={17} />}</button><Brand /></div><div className="hidden text-[12px] font-semibold text-[#78857d] md:block">{workspace?.name ?? 'Organization workspace'} <span className="mx-2 text-[#b2bab2]">/</span> {active}</div>
        <div className="flex items-center gap-2"><span className="mono rounded-full border border-[#d8dfd7] bg-white px-2.5 py-1 text-[9px] uppercase tracking-[.1em] text-[#617168]">CONTROL PLANE</span><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dce9df] text-[10px] font-bold text-[#1f6a56]">{workspace?.role?.slice(0,1).toUpperCase() ?? 'N'}</div></div>
      </div>
      {mobileMenuOpen && <div className="border-b border-[#dbe0d9] bg-[#faf9f4] px-5 py-3 md:hidden">
        <p className="mono mb-2 text-[9px] uppercase tracking-[.12em] text-[#87928b]">{workspace?.name ?? 'Organization workspace'}</p>
        <nav className="space-y-1">{navItems.map((item) => <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] font-semibold ${active === item.label ? 'bg-[#e8efe8] text-[#246b56]' : 'text-[#52636c] hover:bg-[#eff2ec]'}`}>{item.icon}{item.label}</Link>)}</nav>
        <button onClick={() => signOut({ redirectUrl: basePath || '/' })} className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[12px] font-semibold text-[#52636c] hover:bg-[#eff2ec]"><LogOut size={16} />Sign out</button>
      </div>}
      <main className="mx-auto max-w-[1320px] px-5 py-7 md:px-9 md:py-9">{children}</main>
    </div>
  </div>;
}

const metrics: { key: keyof DashboardSummary; label: string; icon: React.ReactNode; group: string }[] = [
  { key: 'activeAgents', label: 'Active agents', icon: <Bot size={17} />, group: 'WORKFORCE' },
  { key: 'businessesEnabled', label: 'Modules enabled', icon: <Blocks size={17} />, group: 'WORKFORCE' },
  { key: 'tasksRunning', label: 'Tasks running', icon: <Activity size={17} />, group: 'OPERATIONS' },
  { key: 'tasksCompleted', label: 'Tasks completed', icon: <Check size={17} />, group: 'OPERATIONS' },
  { key: 'leads', label: 'Leads', icon: <ArrowUpRight size={17} />, group: 'BUSINESS' },
  { key: 'customers', label: 'Customers', icon: <Building2 size={17} />, group: 'BUSINESS' },
  { key: 'appointments', label: 'Appointments', icon: <Activity size={17} />, group: 'SERVICE' },
  { key: 'supportRequests', label: 'Support requests', icon: <MessageSquareText size={17} />, group: 'SERVICE' },
  { key: 'automations', label: 'Automations', icon: <Zap size={17} />, group: 'CONTROL' },
  { key: 'approvalsRequired', label: 'Approvals required', icon: <BadgeCheck size={17} />, group: 'CONTROL' },
];

function Dashboard() {
  const [command, setCommand] = useState('');
  const [commandNotice, setCommandNotice] = useState('');
  const [commandResult, setCommandResult] = useState<CommandStatus | null>(null);
  const [approvalNotice, setApprovalNotice] = useState('');
  const client = useQueryClient();
  const { isSignedIn } = useUser();
  const { data: workspace, isLoading: workspaceLoading, isError: workspaceError, refetch: refetchWorkspace } = useGetWorkspace({ query: { queryKey: getGetWorkspaceQueryKey(), retry: false, enabled: !!isSignedIn } });
  const summaryQ = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey(), enabled: !!workspace } });
  const activityQ = useGetDashboardActivity({ query: { queryKey: getGetDashboardActivityQueryKey(), enabled: !!workspace } });
  const approvalsQ = useGetPendingCommandApprovals({ query: { queryKey: getGetPendingCommandApprovalsQueryKey(), enabled: !!workspace } });
  const submitCommand = useSubmitCommand();
  const decideApproval = useDecideCommandApproval();
  const summary = summaryQ.data as DashboardSummary | undefined;
  const groups = [...new Set(metrics.map((metric) => metric.group))];
  async function sendCommand(e: FormEvent) {
    e.preventDefault();
    if (!command.trim()) return;
    setCommandNotice('');
    setCommandResult(null);
    submitCommand.mutate({ data: { prompt: command.trim() } }, {
      onSuccess: (result) => {
        setCommandResult(result);
        setCommand('');
        void client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        void client.invalidateQueries({ queryKey: getGetDashboardActivityQueryKey() });
        void client.invalidateQueries({ queryKey: getGetPendingCommandApprovalsQueryKey() });
      },
      onError: (error) => {
        const status = (error as { status?: number }).status;
        setCommandNotice(status === 429
          ? 'Command limit reached. Wait before submitting another command.'
          : status === 502
            ? 'OneCore could not prepare a reliable response. No actions were executed.'
            : 'Command could not be submitted. Try again.');
      },
    });
  }
  function reviewCommand(approvalId: string, decision: 'approve' | 'reject') {
    setApprovalNotice('');
    decideApproval.mutate({ approvalId, data: { decision } }, {
      onSuccess: (result) => {
        setApprovalNotice(result.message);
        void client.invalidateQueries({ queryKey: getGetPendingCommandApprovalsQueryKey() });
        void client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        void client.invalidateQueries({ queryKey: getGetDashboardActivityQueryKey() });
      },
      onError: (error) => {
        const status = (error as { status?: number }).status;
        setApprovalNotice(status === 403
          ? 'Only an organization owner or administrator can review this proposal.'
          : 'The proposal could not be reviewed. Refresh and try again.');
      },
    });
  }
  const canReviewCommands = workspace?.role === 'owner' || workspace?.role === 'admin';
  return <SignedGate><WorkspaceLayout active="Overview">
    {workspaceLoading ? <div className="space-y-4"><div className="h-8 w-64 animate-pulse rounded bg-[#e2e7df]" /><div className="grid gap-3 md:grid-cols-3">{[1,2,3].map((n) => <div key={n} className="h-28 animate-pulse rounded-xl bg-white" />)}</div></div>
    : workspaceError || !workspace ? <RetryPanel title="Workspace unavailable" text="We couldn't load the signed-in workspace. Try again; the API controls access." onRetry={() => void refetchWorkspace()} />
    : <div className="enter">
      <div className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div><p className="mono text-[9px] uppercase tracking-[.18em] text-[#a37b36]">ONECORE COMMAND CENTER / 01</p><h1 className="display mt-2 text-4xl font-semibold tracking-[-.05em] md:text-5xl">Good to have you,<br className="md:hidden" /> {workspace.name}.</h1><p className="mt-2 text-[13px] text-[#68757a]">Your operational picture, as persisted by your workspace.</p></div>
        <div className="flex items-center gap-2"><Button href="/catalog#catalog" tone="outline"><Plus size={15} /> Browse modules</Button><span className="mono rounded-full border border-[#d9e0d8] bg-white px-3 py-2 text-[9px] uppercase tracking-[.12em] text-[#68766f]">{workspace.role} access</span></div>
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {groups.map((group) => <section key={group} className="rounded-xl border border-[#dce2da] bg-[#fafaf6] p-3.5">
          <p className="mono mb-3 text-[8px] uppercase tracking-[.15em] text-[#929b91]">{group}</p>
          <div className="space-y-2">{metrics.filter((m) => m.group === group).map((metric) => <div key={metric.key} className="flex items-center justify-between gap-2 rounded-lg border border-[#e5e8e1] bg-white px-3 py-2.5" data-testid={`metric-${metric.key}`}>
            <span className="flex items-center gap-2 text-[10px] font-semibold text-[#617078]"><span className="text-[#3b7864]">{metric.icon}</span>{metric.label}</span>
            {summaryQ.isLoading ? <span className="h-4 w-7 animate-pulse rounded bg-[#e7ebe5]" /> : summaryQ.isError ? <span className="text-[10px] text-[#ae5148]">—</span> : <span className="display text-lg font-semibold text-[#243640]">{summary?.[metric.key] ?? 0}</span>}
          </div>)}</div>
        </section>)}
      </div>
      {summaryQ.isError && <RetryPanel title="Metrics couldn't load" text="Metrics are persisted workspace counts. Nothing is estimated or filled in." onRetry={() => void summaryQ.refetch()} />}
      <div className="grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
        <section className="rounded-xl border border-[#dce2da] bg-white p-5 md:p-6">
          <div className="flex items-start justify-between"><div><p className="mono text-[9px] uppercase tracking-[.15em] text-[#9c7939]">CONTROL / NATURAL LANGUAGE</p><h2 className="display mt-1 text-xl font-semibold">Ask OneCore</h2><p className="mt-1 text-[11px] text-[#718078]">OneCore drafts administrative responses. Proposed actions require owner or administrator review; no external action runs here.</p></div><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f5eddc] text-[#9a742d]"><Command size={17} /></div></div>
          <form className="mt-5" onSubmit={sendCommand}><label htmlFor="command-entry" className="sr-only">Command</label><div className="flex flex-col gap-2 sm:flex-row"><input id="command-entry" value={command} onChange={(e) => setCommand(e.target.value)} maxLength={4000} placeholder="Describe the work you want OneCore to coordinate…" className="h-11 min-w-0 flex-1 rounded-lg border border-[#dce2da] bg-[#fafaf7] px-3 text-[12px] outline-none focus:border-[#4f8b77]" data-testid="input-command" /><button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#1f6a56] px-4 text-[12px] font-bold text-white disabled:opacity-50" type="submit" disabled={!command.trim() || submitCommand.isPending} data-testid="button-submit-command">{submitCommand.isPending ? 'Submitting…' : 'Submit command'} <ArrowRight size={14} /></button></div></form>
          <div className="mt-3 rounded-lg border border-[#eadfbe] bg-[#fcf7e9] px-3 py-2.5"><p className="flex items-center gap-2 text-[10px] font-bold text-[#785d2c]"><CircleHelp size={14} /> Administrative assistance only</p><p className="mt-1 text-[10px] leading-4 text-[#7c725c]">Health, finance, and legal workflows do not provide licensed decisions. Proposed actions are reviewed before any connected workflow can act.</p></div>
          {commandNotice && <p role="status" className="mt-3 rounded-lg border border-[#e6c7c2] bg-[#fff7f4] px-3 py-2 text-[11px] font-semibold text-[#563d3b]" data-testid="status-command">{commandNotice}</p>}
          {commandResult && <div role="status" className={`mt-3 rounded-lg border px-3 py-3 ${commandResult.status === 'unavailable' ? 'border-[#eadfbe] bg-[#fcf7e9]' : 'border-[#cbded0] bg-[#edf5ed]'}`} data-testid="status-command">
            <p className={`text-[11px] font-bold ${commandResult.status === 'unavailable' ? 'text-[#785d2c]' : 'text-[#315c49]'}`}>{commandResult.message}</p>
            {commandResult.response && <p className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-[#40554a]">{commandResult.response}</p>}
            {!!commandResult.actions?.length && <div className="mt-3 space-y-2">{commandResult.actions.map((action, index) => <div key={`${action.title}-${index}`} className="rounded-lg border border-[#d5e3d5] bg-white/80 px-3 py-2"><p className="text-[10px] font-bold text-[#304d40]">{action.title}</p><p className="mt-1 text-[10px] leading-4 text-[#66766b]">{action.description}</p></div>)}</div>}
          </div>}
        </section>
        <section className="rounded-xl border border-[#dce2da] bg-white p-5 md:p-6">
          <div className="flex items-start justify-between"><div><p className="mono text-[9px] uppercase tracking-[.15em] text-[#9c7939]">RECENT EVENTS</p><h2 className="display mt-1 text-xl font-semibold">Workspace activity</h2></div><Activity size={17} className="text-[#3b7864]" /></div>
          {activityQ.isLoading ? <div className="mt-5 space-y-3">{[1,2,3].map((n) => <div key={n} className="h-12 animate-pulse rounded-lg bg-[#f0f2ed]" />)}</div>
          : activityQ.isError ? <div className="mt-5"><RetryPanel title="Activity unavailable" text="Recent events could not be loaded." onRetry={() => void activityQ.refetch()} /></div>
          : activityQ.data?.length ? <div className="mt-4 divide-y divide-[#edf0eb]">{activityQ.data.map((item) => <ActivityRow item={item} key={item.id} />)}</div>
          : <div className="mt-5 rounded-lg border border-dashed border-[#d7dfd8] bg-[#fafbf7] px-4 py-8 text-center"><div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-[#e9efe8] text-[#38735e]"><Activity size={16} /></div><p className="mt-3 text-[12px] font-bold">No activity recorded</p><p className="mt-1 text-[10px] text-[#78847e]">Events appear here when the workspace API records them.</p></div>}
        </section>
      </div>
      <section className="mt-4 rounded-xl border border-[#dce2da] bg-white p-5 md:p-6" data-testid="section-command-approvals">
        <div className="flex items-start justify-between gap-3"><div><p className="mono text-[9px] uppercase tracking-[.15em] text-[#9c7939]">HUMAN REVIEW</p><h2 className="display mt-1 text-xl font-semibold">Proposed actions</h2><p className="mt-1 text-[11px] text-[#718078]">Review the full proposal before recording a decision. Approval does not run external actions.</p></div><BadgeCheck size={18} className="text-[#3b7864]" /></div>
        {approvalNotice && <p role="status" className="mt-3 rounded-lg border border-[#cbded0] bg-[#edf5ed] px-3 py-2 text-[11px] font-semibold text-[#315c49]">{approvalNotice}</p>}
        {approvalsQ.isLoading ? <div className="mt-4 h-20 animate-pulse rounded-lg bg-[#f0f2ed]" />
          : approvalsQ.isError ? <div className="mt-4"><RetryPanel title="Proposals unavailable" text="Pending approvals could not be loaded." onRetry={() => void approvalsQ.refetch()} /></div>
          : approvalsQ.data?.length ? <div className="mt-4 space-y-3">{approvalsQ.data.map((approval) => <CommandApprovalCard key={approval.id} approval={approval} canReview={canReviewCommands} disabled={decideApproval.isPending} onDecision={reviewCommand} />)}</div>
          : <p className="mt-4 rounded-lg border border-dashed border-[#d7dfd8] bg-[#fafbf7] px-4 py-6 text-center text-[11px] text-[#718078]">No proposed actions are awaiting review.</p>}
      </section>
      <EnabledModules enabled={workspace.enabledBusinesses} />
    </div>}
  </WorkspaceLayout></SignedGate>;
}

function CommandApprovalCard({ approval, canReview, disabled, onDecision }: { approval: CommandApproval; canReview: boolean; disabled: boolean; onDecision: (id: string, decision: 'approve' | 'reject') => void }) {
  const createdAt = new Date(approval.createdAt);
  return <article className="rounded-lg border border-[#e0e5dd] bg-[#fbfcf8] p-4" data-testid={`command-approval-${approval.id}`}>
    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start"><div><p className="text-[12px] font-bold text-[#2b3c40]">{approval.actions.length} proposed {approval.actions.length === 1 ? 'action' : 'actions'}</p><p className="mt-1 text-[9px] text-[#7d8981]">Requested by a workspace member · {Number.isNaN(createdAt.getTime()) ? '' : createdAt.toLocaleString()}</p></div><span className="mono w-fit rounded-full bg-[#f4eddc] px-2.5 py-1 text-[8px] uppercase tracking-[.1em] text-[#795f30]">Awaiting review</span></div>
    <div className="mt-3 rounded-md border border-[#e8ece5] bg-white px-3 py-2"><p className="mono text-[8px] uppercase tracking-[.12em] text-[#89948b]">REQUEST</p><p className="mt-1 whitespace-pre-wrap text-[10px] leading-4 text-[#586861]">{approval.prompt}</p></div>
    <p className="mt-3 whitespace-pre-wrap text-[11px] leading-5 text-[#40554a]">{approval.response}</p>
    <div className="mt-3 space-y-2">{approval.actions.map((action, index) => <div key={`${action.title}-${index}`} className="rounded-md border border-[#dce5dc] bg-white px-3 py-2"><p className="text-[10px] font-bold text-[#304d40]">{action.title}</p><p className="mt-1 text-[10px] leading-4 text-[#66766b]">{action.description}</p></div>)}</div>
    {canReview ? <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={disabled} onClick={() => onDecision(approval.id, 'approve')} className="rounded-lg bg-[#1f6a56] px-3 py-2 text-[10px] font-bold text-white disabled:opacity-50" data-testid={`button-approve-${approval.id}`}>Approve proposal</button><button type="button" disabled={disabled} onClick={() => onDecision(approval.id, 'reject')} className="rounded-lg border border-[#d9c9c5] bg-white px-3 py-2 text-[10px] font-bold text-[#89514b] disabled:opacity-50" data-testid={`button-reject-${approval.id}`}>Reject proposal</button></div>
      : <p className="mt-3 rounded-md bg-[#f4f1e8] px-3 py-2 text-[10px] text-[#746748]">An organization owner or administrator must review this proposal.</p>}
  </article>;
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const date = new Date(item.createdAt);
  return <div className="flex gap-3 py-3" data-testid={`activity-item-${item.id}`}><div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#edf2ed] text-[#38735e]"><Activity size={14} /></div><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><p className="truncate text-[11px] font-bold">{item.title}</p><time className="mono shrink-0 text-[8px] text-[#89938c]">{Number.isNaN(date.getTime()) ? '' : date.toLocaleString()}</time></div><p className="mt-1 text-[10px] leading-4 text-[#718078]">{item.detail}</p><p className="mono mt-1 text-[8px] uppercase tracking-[.1em] text-[#9aa49c]">{item.type}</p></div></div>;
}
function EnabledModules({ enabled }: { enabled: string[] }) {
  const { data: businesses, isLoading } = useListBusinesses();
  const active = (businesses ?? []).filter((b) => enabled.includes(b.slug));
  return <section className="mt-5 rounded-xl border border-[#dce2da] bg-white p-5 md:p-6"><div className="flex items-center justify-between"><div><p className="mono text-[9px] uppercase tracking-[.15em] text-[#9c7939]">WORKSPACE CONFIGURATION</p><h2 className="display mt-1 text-xl font-semibold">Enabled modules</h2></div><Link href="/catalog#catalog" className="text-[11px] font-bold text-[#286e59]">Browse catalog <ArrowRight className="ml-1 inline" size={13} /></Link></div>{isLoading ? <div className="mt-4 h-16 animate-pulse rounded-lg bg-[#f0f2ed]" /> : active.length ? <div className="mt-4 flex flex-wrap gap-2">{active.map((business) => <Link key={business.slug} href={`/business/${business.slug}`} className="rounded-lg border border-[#dce3da] bg-[#f8faf6] px-3 py-2 text-[11px] font-semibold text-[#43554f]">{business.name} <ArrowUpRight className="ml-1 inline text-[#28705a]" size={13} /></Link>)}</div> : <p className="mt-4 rounded-lg border border-dashed border-[#d7dfd8] bg-[#fafbf7] px-4 py-5 text-[11px] text-[#718078]">No modules enabled yet. Browse the catalog to review what is available.</p>}</section>;
}

function RetryPanel({ title, text, onRetry }: { title: string; text: string; onRetry: () => void }) {
  return <div className="rounded-lg border border-[#e6c7c2] bg-[#fff7f4] p-4"><div className="flex items-start gap-3"><CircleHelp className="mt-0.5 text-[#ae5148]" size={17} /><div className="flex-1"><p className="text-[12px] font-bold text-[#563d3b]">{title}</p><p className="mt-1 text-[11px] leading-5 text-[#776663]">{text}</p><button onClick={onRetry} className="mt-2 text-[11px] font-bold text-[#8e413a]" data-testid="button-retry">Retry</button></div></div></div>;
}

const flagshipWorkflowCopy: Record<string, { title: string; placeholder: string; prompt: string }> = {
  'ai-sales': { title: 'Sales qualification workflow', placeholder: 'Example: New inbound lead from a 20-person HVAC company asking for 24/7 enquiry handling.', prompt: 'Act as the AI Sales Agent. Qualify this lead, identify missing information, draft the best next response, and propose follow-up actions. Use only the context below. Do not claim any message was sent or CRM was updated. Context: ' },
  'ai-marketing': { title: 'Marketing campaign workflow', placeholder: 'Example: Local plumbing company wants more emergency-call leads with a $500 monthly ad budget.', prompt: 'Act as the AI Marketing Automation module. Build a concise campaign plan, audience, offer, channels, creative angles, measurement plan, and proposed next actions. Do not claim ads were launched or accounts changed. Context: ' },
  'ai-customer-support': { title: 'Customer support workflow', placeholder: 'Example: Customer says the technician is 45 minutes late and wants an immediate update.', prompt: 'Act as the AI Customer Support Agent. Classify urgency and sentiment, draft a helpful response, list information to verify, and propose escalation actions. Do not claim a reply was sent or a ticket was changed. Context: ' },
  'ai-real-estate': { title: 'Real-estate lead workflow', placeholder: 'Example: Buyer wants a 2-bedroom apartment under $400k, move-in within 60 days.', prompt: 'Act as the AI Real Estate Lead & Sales Agent. Qualify the lead, summarize requirements, identify missing questions, draft the next response, and propose follow-up actions. Do not provide legal/financial advice or claim outreach was sent. Context: ' },
  'ai-logistics': { title: 'Logistics dispatch workflow', placeholder: 'Example: Same-day delivery is delayed; pickup is complete and customer ETA needs an update.', prompt: 'Act as the AI Logistics & Dispatch module. Triage this case, identify missing operational data, produce a dispatch/communication plan, and propose next actions. Do not claim routes, drivers, orders, or external systems were changed. Context: ' },
};

function FlagshipWorkflow({ business, isSignedIn }: { business: Business; isSignedIn: boolean | undefined }) {
  const config = flagshipWorkflowCopy[business.slug];
  const [context, setContext] = useState('');
  const [result, setResult] = useState<CommandStatus | null>(null);
  const [error, setError] = useState('');
  const submit = useSubmitCommand();
  const client = useQueryClient();
  if (!config) return null;
  function run(e: FormEvent) {
    e.preventDefault();
    if (!context.trim()) return;
    setError('');
    setResult(null);
    submit.mutate({ data: { prompt: config.prompt + context.trim() } }, {
      onSuccess: (response) => {
        setResult(response);
        void client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        void client.invalidateQueries({ queryKey: getGetDashboardActivityQueryKey() });
        void client.invalidateQueries({ queryKey: getGetPendingCommandApprovalsQueryKey() });
      },
      onError: (failure) => {
        const status = (failure as { status?: number }).status;
        setError(status === 429 ? 'Command limit reached. Please wait before running another workflow.' : status === 502 ? 'OneCore AI could not prepare a reliable response. No action was executed.' : 'Workflow could not run. Please retry.');
      },
    });
  }
  return <section className="mt-4 rounded-xl border border-[#cbded0] bg-[#f4f8f2] p-5" data-testid="section-flagship-workflow">
    <div className="flex items-start justify-between gap-3"><div><p className="mono text-[9px] uppercase tracking-[.14em] text-[#347356]">INTERACTIVE AI WORKFLOW</p><h2 className="display mt-1 text-xl font-semibold">{config.title}</h2><p className="mt-2 text-[11px] leading-5 text-[#64736b]">Runs through the authenticated OneCore AI command service. Enter real context or clearly labeled sample data. Generated actions are proposals only and require human review; no external action is executed here.</p></div><Sparkles size={18} className="text-[#347356]" /></div>
    {!isSignedIn ? <Button href="/sign-in" className="mt-4">Sign in to run workflow <ArrowRight size={14} /></Button> :
    <form onSubmit={run} className="mt-4"><textarea value={context} onChange={(e) => setContext(e.target.value)} maxLength={4000} rows={4} placeholder={config.placeholder} className="w-full resize-y rounded-lg border border-[#cbd8ce] bg-white p-3 text-[11px] outline-none focus:border-[#4f8b77]" data-testid="input-flagship-context" /><div className="mt-3 flex flex-wrap items-center gap-3"><button type="submit" disabled={!context.trim() || submit.isPending} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1f6a56] px-4 py-2.5 text-[12px] font-bold text-white disabled:opacity-50" data-testid="button-run-flagship">{submit.isPending ? 'Running…' : 'Run AI workflow'} <ArrowRight size={14} /></button><span className="text-[9px] text-[#78847e]">Nothing is sent, published, booked, dispatched, or changed automatically.</span></div></form>}
    {error && <p role="status" className="mt-3 rounded-lg border border-[#e6c7c2] bg-[#fff7f4] px-3 py-2 text-[11px] font-semibold text-[#563d3b]">{error}</p>}
    {result && <div role="status" className={`mt-3 rounded-lg border px-3 py-3 ${result.status === 'unavailable' ? 'border-[#eadfbe] bg-[#fcf7e9]' : 'border-[#cbded0] bg-white'}`}><p className="text-[11px] font-bold text-[#315c49]">{result.message}</p>{result.response && <p className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-[#40554a]">{result.response}</p>}{!!result.actions?.length && <div className="mt-3 space-y-2">{result.actions.map((action, index) => <div key={`${action.title}-${index}`} className="rounded-lg border border-[#d5e3d5] bg-[#f8faf6] px-3 py-2"><p className="text-[10px] font-bold text-[#304d40]">{action.title}</p><p className="mt-1 text-[10px] leading-4 text-[#66766b]">{action.description}</p></div>)}</div>} {!!result.actions?.length && <Button href="/dashboard" tone="outline" className="mt-3">Review proposals in Command Center <BadgeCheck size={14} /></Button>}</div>}
  </section>;
}

function BusinessWorkspace() {
  const [, params] = useRoute('/business/:slug');
  const slug = params?.slug ?? '';
  const [requestMessage, setRequestMessage] = useState('');
  const [notice, setNotice] = useState('');
  const client = useQueryClient();
  const catalog = useListBusinesses();
  const { isSignedIn } = useUser();
  const workspaceQ = useGetWorkspace({ query: { queryKey: getGetWorkspaceQueryKey(), retry: false, enabled: !!isSignedIn } });
  const business = catalog.data?.find((item) => item.slug === slug);
  const activate = useActivateBusiness();
  const deactivate = useDeactivateBusiness();
  const deployment = useCreateDeploymentRequest();
  const isEnabled = workspaceQ.data?.enabledBusinesses.includes(slug) ?? false;
  const writable = workspaceQ.data?.role === 'owner' || workspaceQ.data?.role === 'admin' || workspaceQ.data?.role === 'user';
  function refreshWorkspace() {
    void client.invalidateQueries({ queryKey: getGetWorkspaceQueryKey() });
    void client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  }
  function toggleModule() {
    if (!business) return;
    const mutation = isEnabled ? deactivate : activate;
    mutation.mutate({ slug }, { onSuccess: () => { setNotice(isEnabled ? 'Module disabled for this workspace.' : 'Module enabled for this workspace.'); refreshWorkspace(); }, onError: () => setNotice('The workspace could not be updated. Please retry.') });
  }
function requestDeployment(e: FormEvent) {
    e.preventDefault();
    if (!business) return;
    deployment.mutate({ data: { businessSlug: business.slug, message: requestMessage || undefined } }, {
      onSuccess: (request) => { setNotice(`Deployment request ${request.id} was recorded in this workspace.`); setRequestMessage(''); refreshWorkspace(); },
      onError: () => setNotice('Deployment request could not be submitted. Please retry.'),
    });
  }
  return <div className="min-h-[100dvh] bg-[#f3f3ed]"><Header workspaceName={workspaceQ.data?.name} />
      <main className="mx-auto max-w-[1120px] px-5 py-9 md:px-8 md:py-12">
        {catalog.isLoading ? <div className="h-72 animate-pulse rounded-2xl bg-white" />
        : catalog.isError ? <RetryPanel title="Module details unavailable" text="The catalog could not load this module. Retry the catalog request." onRetry={() => void catalog.refetch()} />
        : !business ? <div className="rounded-2xl border border-[#dce2da] bg-white p-9 text-center"><p className="display text-2xl font-semibold">Module not found</p><p className="mt-2 text-sm text-[#68757a]">This module is not present in the business catalog.</p><Button href="/" className="mt-5">Return to catalog</Button></div>
        : <div className="enter">
          <Link href="/catalog#catalog" className="mono text-[9px] uppercase tracking-[.15em] text-[#728078] hover:text-[#1f6a56]">← BUSINESS CATALOG</Link>
          <div className="mt-5 rounded-2xl border border-[#dbe1d9] bg-[#fffefa] p-6 md:p-10">
            <div className="flex flex-col justify-between gap-6 md:flex-row">
              <div className="max-w-[680px]"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#e9efe8] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-[#39715d]">{business.industry}</span><span className="rounded-full bg-[#f6ecd4] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-[#89682b]">{business.phase === 'flagship' ? 'Flagship · Interactive AI' : 'Catalog module'}</span>{isEnabled && <span className="rounded-full bg-[#e1f0e3] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-[#347049]">Enabled</span>}</div>
                <h1 className="display mt-5 text-4xl font-semibold tracking-[-.045em] md:text-6xl">{business.name}</h1><p className="mt-4 text-[15px] leading-7 text-[#5e6c73]">{business.description}</p>
                <div className="mt-6 flex flex-wrap gap-2">{business.capabilities.map((capability) => <span key={capability} className="rounded-full border border-[#dce2da] bg-[#fafaf6] px-3 py-1.5 text-[10px] font-semibold text-[#52626a]">{capability}</span>)}</div>
              </div>
              <div className="w-full shrink-0 self-start rounded-xl border border-[#dce2da] bg-[#f7f8f2] p-4 md:w-[270px]">
                <p className="mono text-[9px] uppercase tracking-[.14em] text-[#8c968c]">WORKSPACE ACCESS</p>
                <p className="mt-2 text-[12px] leading-5 text-[#68757a]">{isEnabled ? 'This module is enabled for your organization.' : 'Enable this module to include it in your organization workspace.'}</p>
                {isSignedIn
                  ? <Button onClick={toggleModule} disabled={!writable || activate.isPending || deactivate.isPending || workspaceQ.isLoading || workspaceQ.isError} className="mt-4 w-full">{activate.isPending || deactivate.isPending ? 'Updating…' : isEnabled ? 'Disable module' : 'Enable module'} <ArrowRight size={14} /></Button>
                  : <Button href="/sign-in" className="mt-4 w-full">Sign in to enable this module <ArrowRight size={14} /></Button>}
                {isSignedIn && workspaceQ.isError && <p className="mt-3 text-[10px] leading-4 text-[#9b4b42]">Workspace access could not be verified. Reload before changing module access.</p>}
                <p className="mt-3 text-[9px] leading-4 text-[#89938c]">The API enforces permissions. Changes update persisted workspace configuration.</p>
              </div>
            </div>
            <div className="mt-10 grid gap-4 border-t border-[#e4e8e1] pt-7 md:grid-cols-2">
              <div className="rounded-xl border border-[#dce2da] bg-white p-5"><p className="mono text-[9px] uppercase tracking-[.14em] text-[#9c7939]">BUSINESS FUNCTION</p><h2 className="display mt-2 text-xl font-semibold">{business.function}</h2><p className="mt-2 text-[12px] leading-5 text-[#68757a]">A configured function within the {business.industry} industry catalog.</p></div>
              <div className="rounded-xl border border-[#dce2da] bg-white p-5"><p className="mono text-[9px] uppercase tracking-[.14em] text-[#9c7939]">WORKFLOW DEFINITION</p><h2 className="display mt-2 text-xl font-semibold">Catalog specification</h2><p className="mt-2 text-[12px] leading-5 text-[#68757a]">{business.workflow}</p></div>
            </div>
          </div>
          {business.phase === 'flagship' && <FlagshipWorkflow business={business} isSignedIn={isSignedIn} />}
          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_.85fr]">
            <div className="rounded-xl border border-[#dfd3b4] bg-[#fbf6e8] p-5"><div className="flex items-start gap-3"><div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#f1e5c6] text-[#916f2f]"><CircleHelp size={17} /></div><div><p className="text-[12px] font-bold text-[#4d4534]">{business.phase === 'flagship' ? 'AI workflow available' : 'Operational workflows are not live'}</p><p className="mt-1 text-[11px] leading-5 text-[#786f5b]">{business.phase === 'flagship' ? 'This flagship module can prepare AI analysis and proposed actions through OneCore. External execution is intentionally disabled until a reviewed integration is connected.' : 'This module is catalog-only today; operational workflows are not available.'}</p></div></div></div>
            {isSignedIn
              ? <form onSubmit={requestDeployment} className="rounded-xl border border-[#dce2da] bg-white p-5"><div className="flex items-center justify-between"><div><p className="mono text-[9px] uppercase tracking-[.14em] text-[#9c7939]">DEPLOYMENT SUPPORT</p><p className="mt-1 text-[12px] font-bold">Request deployment assistance</p></div><ExternalLink size={16} className="text-[#658072]" /></div><textarea value={requestMessage} onChange={(e) => setRequestMessage(e.target.value)} maxLength={2000} rows={2} placeholder="Optional context for your request" className="mt-3 w-full resize-y rounded-lg border border-[#dce2da] bg-[#fafaf7] p-3 text-[11px] outline-none focus:border-[#4f8b77]" data-testid="input-deployment-message" /><Button className="mt-3 w-full" disabled={deployment.isPending}>{deployment.isPending ? 'Submitting request…' : 'Submit request'} <ArrowRight size={14} /></Button><p className="mt-2 text-[9px] leading-4 text-[#88928a]">Request submission is recorded in this workspace; it does not activate a workflow. Pricing and billing are Phase 6.</p></form>
              : <div className="rounded-xl border border-[#dce2da] bg-white p-5"><p className="mono text-[9px] uppercase tracking-[.14em] text-[#9c7939]">DEPLOYMENT SUPPORT</p><p className="mt-1 text-[12px] font-bold">Request deployment assistance</p><p className="mt-2 text-[10px] leading-4 text-[#718078]">Sign in to record a deployment request for your organization.</p><Button href="/sign-in" className="mt-4 w-full">Sign in to request help <ArrowRight size={14} /></Button></div>}
          </div>
          {notice && <p role="status" className="mt-4 rounded-lg border border-[#cbded0] bg-[#edf5ed] px-4 py-3 text-[11px] font-semibold text-[#315c49]" data-testid="status-business-action">{notice}</p>}
        </div>}
      </main>
  </div>;
}

function Admin() {
  const { isSignedIn } = useUser();
  const { data: workspace, isLoading, isError, refetch } = useGetWorkspace({ query: { queryKey: getGetWorkspaceQueryKey(), retry: false, enabled: !!isSignedIn } });
  const allowed = workspace?.role === 'owner' || workspace?.role === 'admin';
  return <SignedGate><WorkspaceLayout active="Organization">
    {isLoading ? <div className="h-40 animate-pulse rounded-xl bg-white" /> : isError || !workspace ? <RetryPanel title="Organization access unavailable" text="Could not verify your workspace role. Retry or contact your organization owner." onRetry={() => void refetch()} /> : !allowed ? <div className="rounded-xl border border-[#e5d7bb] bg-[#fbf6e8] p-8"><ShieldCheck className="text-[#9a742d]" /><h1 className="display mt-4 text-2xl font-semibold">Owner or admin access required</h1><p className="mt-2 text-sm leading-6 text-[#716a5b]">Your workspace role is <strong>{workspace.role}</strong>. This page is restricted to organization owners and admins. API authorization remains authoritative.</p><Button href="/dashboard" tone="outline" className="mt-4">Return to command center</Button></div>
    : <div className="enter"><p className="mono text-[9px] uppercase tracking-[.18em] text-[#a37b36]">ORGANIZATION CONTROL / 02</p><h1 className="display mt-2 text-4xl font-semibold tracking-[-.045em]">Organization settings</h1><p className="mt-2 text-[13px] text-[#68757a]">Workspace identity and module configuration at a glance.</p>
      <section className="mt-7 grid gap-4 md:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-xl border border-[#dce2da] bg-white p-6"><p className="mono text-[9px] uppercase tracking-[.14em] text-[#9c7939]">WORKSPACE PROFILE</p><div className="mt-5 flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e8eee7] text-[#286d57]"><Building2 size={21} /></div><div><h2 className="display text-xl font-semibold">{workspace.name}</h2><p className="mt-1 text-[11px] text-[#77837d]">Workspace ID <span className="mono">{workspace.id}</span></p></div></div><div className="mt-5 flex items-center justify-between border-t border-[#e8ebe5] pt-4"><span className="text-[11px] text-[#647078]">Your permission</span><span className="rounded-full bg-[#e8efe8] px-3 py-1 text-[10px] font-bold capitalize text-[#316e58]">{workspace.role}</span></div></div>
        <div className="rounded-xl border border-[#dce2da] bg-white p-6"><p className="mono text-[9px] uppercase tracking-[.14em] text-[#9c7939]">CAPABILITY READINESS</p><div className="mt-4 space-y-3"><Readiness label="Browse business catalog" phase="LIVE" /><Readiness label="Flagship interactive AI workflows" phase="LIVE" /><Readiness label="OneCore AI command drafts" phase="REVIEW-GATED" /><Readiness label="Pricing & billing" phase="PHASE 6" /></div><p className="mt-4 text-[10px] leading-4 text-[#87918a]">Five flagship modules provide interactive AI workflows. Other business modules remain catalog-only. OneCore requires a configured AI integration; proposed actions require owner or administrator review and do not execute external actions.</p></div>
      </section>
      <div className="mt-4 rounded-xl border border-[#dce2da] bg-white p-6"><div className="flex items-center justify-between"><div><p className="mono text-[9px] uppercase tracking-[.14em] text-[#9c7939]">ENABLED CONFIGURATION</p><h2 className="display mt-1 text-xl font-semibold">Business modules</h2></div><Link href="/catalog#catalog" className="text-[11px] font-bold text-[#286e59]">Browse modules <ArrowRight className="ml-1 inline" size={13} /></Link></div><p className="mt-3 text-[11px] text-[#718078]">{workspace.enabledBusinesses.length} modules enabled in this workspace. Manage module access from its catalog detail page.</p><div className="mt-4 flex flex-wrap gap-2">{workspace.enabledBusinesses.length ? workspace.enabledBusinesses.map((slug) => <Link href={`/business/${slug}`} key={slug} className="rounded-lg border border-[#dce3da] bg-[#f8faf6] px-3 py-2 text-[10px] font-semibold text-[#43554f]">{slug}<ArrowUpRight className="ml-1 inline" size={12} /></Link>) : <span className="rounded-lg border border-dashed border-[#d5ddd5] px-4 py-3 text-[11px] text-[#7b877f]">No enabled modules</span>}</div></div>
    </div>}
  </WorkspaceLayout></SignedGate>;
}
function Readiness({ label, phase }: { label: string; phase: string }) {
  return <div className="flex items-center justify-between gap-3 border-b border-[#edf0eb] pb-2.5"><span className="text-[11px] font-semibold text-[#526169]">{label}</span><span className={`mono text-[8px] uppercase tracking-[.12em] ${phase === 'LIVE' ? 'text-[#347356]' : 'text-[#92722e]'}`}>{phase}</span></div>;
}

function NotFound() {
  return <div className="flex min-h-[100dvh] flex-col items-center justify-center px-5 text-center"><Brand /><p className="mono mt-12 text-[10px] uppercase tracking-[.16em] text-[#a37b36]">404 / ROUTE NOT FOUND</p><h1 className="display mt-3 text-4xl font-semibold">This route is off the map.</h1><p className="mt-2 text-sm text-[#68757a]">The page may have moved or may not exist.</p><Button href="/" className="mt-6">Back to OneCore <ArrowRight size={14} /></Button></div>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch>
    <Route path="/" component={HomeRedirect} />
    <Route path="/catalog" component={Home} />
    <Route path="/dashboard" component={Dashboard} />
    <Route path="/business/:slug" component={BusinessWorkspace} />
    <Route path="/admin" component={Admin} />
    <Route path="/sign-in/*?" component={SignInPage} />
    <Route path="/sign-up/*?" component={SignUpPage} />
    <Route component={NotFound} />
  </Switch></ErrorBoundary>;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={{
      signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to access your OneCore workspace' } },
      signUp: { start: { title: 'Create your workspace', subtitle: 'Bring your organization into OneCore' } },
    }}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
  >
    <QueryClientProvider client={queryClient}>
      <TooltipProvider><ClerkQueryClientCacheInvalidator /><Router /><Toaster /></TooltipProvider>
    </QueryClientProvider>
  </ClerkProvider>;
}

function App() {
  return <WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter>;
}

export default App;

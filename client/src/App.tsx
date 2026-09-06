import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Redirect, Route, Switch } from "wouter";
import { lazy, Suspense, useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SelectedProductProvider } from "./contexts/SelectedProductContext";
import { StorefrontHeaderProvider } from "./contexts/StorefrontHeaderContext";
import Home from "./pages/Home";
const AdminMarketplaceSafety = lazy(() => import("@/pages/AdminMarketplaceSafety"));
import Account from "./pages/Account";
import Favorites from "./pages/Favorites";
import Wallet from "./pages/Wallet";
import OrderStatus from "./pages/OrderStatus";
const Admin = lazy(() => import("./pages/Admin"));
const AdminTickets = lazy(() => import("./pages/AdminTickets"));
const AdminAccess = lazy(() => import("./pages/AdminAccess"));
const AdminPricing = lazy(() => import("./pages/AdminPricing"));
const AdminPayment = lazy(() => import("./pages/AdminPayment"));
import Checkout from "./pages/Checkout";
import PaymentLink from "./pages/PaymentLink";
const AdminMedia = lazy(() => import("./pages/AdminMedia"));
const AdminPackageArtwork = lazy(() => import("./pages/AdminPackageArtwork"));
const AdminProviderSecurity = lazy(() => import("@/pages/AdminProviderSecurity"));
const AdminContactAdmins = lazy(() => import("@/pages/AdminContactAdmins"));
const AdminGameImages = lazy(() => import("@/pages/AdminGameImages"));
const AdminLoginBans = lazy(() => import("@/pages/AdminLoginBans"));
import AppwriteLogin from "@/pages/AppwriteLogin";
import SupportChatPage from "@/pages/SupportChatPage";
import Legal from "./pages/Legal";
import GameTopup from "./pages/GameTopup";
const LiveSpin = lazy(() => import("./pages/LiveSpin"));

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path="/ai"><Redirect to="/" /></Route>
      <Route path="/login" component={AppwriteLogin} />
      {/* Round 6: live support is its own destination, not an overlay on zurs.me. */}
      <Route path="/chat" component={SupportChatPage} />
      <Route path={"/"} component={Home} />
      <Route path="/topup/:gameId" component={GameTopup} />
      <Route path="/live-spin" component={() => <Suspense fallback={<div className="min-h-screen bg-slate-50" />}><LiveSpin /></Suspense>} />
      <Route path={"/topup"}><Redirect to="/" /></Route>
      <Route path={"/smm"}><Redirect to="/" /></Route>
      <Route path="/marketplace/sell"><Redirect to="/" /></Route>
      <Route path="/marketplace/verify"><Redirect to="/" /></Route>
      <Route path="/marketplace/manage"><Redirect to="/" /></Route>
      <Route path={"/marketplace"}><Redirect to="/" /></Route>
      <Route path={"/account"} component={Account} />
      <Route path={"/favorites"}><Redirect to="/account" /></Route>
      <Route path={"/wallet"} component={Wallet} />
      <Route path={"/order-status"} component={OrderStatus} />
      <Route path="/admin" component={Admin} />
      <Route path="/admin/tickets" component={AdminTickets} />
      <Route path="/admin/access" component={AdminAccess} />
      <Route path="/admin/pricing" component={AdminPricing} />
      <Route path="/admin/payment" component={AdminPayment} />
      <Route path="/admin/marketplace-safety" component={AdminMarketplaceSafety} />
      <Route path="/pay/:token" component={PaymentLink} />
      <Route path={"/checkout/:orderId"} component={Checkout} />
      <Route path={"/admin/media"} component={AdminMedia} />
      <Route path={"/admin/package-artwork"} component={AdminPackageArtwork} />
      <Route path={"/admin/contact-admins"} component={AdminContactAdmins} />
      <Route path={"/admin/game-images"} component={AdminGameImages} />
      <Route path={"/admin/provider-security"} component={AdminProviderSecurity} />
      <Route path={"/admin/login-bans"} component={AdminLoginBans} />
      <Route path="/privacy" component={() => <Legal kind="privacy" />} />
      <Route path="/terms" component={() => <Legal kind="terms" />} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <StorefrontHeaderProvider><SelectedProductProvider><Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
									<Router />
								</Suspense></SelectedProductProvider></StorefrontHeaderProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

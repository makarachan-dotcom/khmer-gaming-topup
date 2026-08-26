import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Redirect, Route, Switch } from "wouter";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SelectedProductProvider } from "./contexts/SelectedProductContext";
import { StorefrontHeaderProvider } from "./contexts/StorefrontHeaderContext";
import Home from "./pages/Home";
import AdminMarketplaceSafety from "@/pages/AdminMarketplaceSafety";
import Account from "./pages/Account";
import Favorites from "./pages/Favorites";
import Wallet from "./pages/Wallet";
import OrderStatus from "./pages/OrderStatus";
import Admin from "./pages/Admin";
import AdminTickets from "./pages/AdminTickets";
import AdminAccess from "./pages/AdminAccess";
import AdminPricing from "./pages/AdminPricing";
import AdminPayment from "./pages/AdminPayment";
import Checkout from "./pages/Checkout";
import AdminMedia from "./pages/AdminMedia";
import AdminPackageArtwork from "./pages/AdminPackageArtwork";
import AdminProviderSecurity from "./pages/AdminProviderSecurity";
import Legal from "./pages/Legal";
import GameTopup from "./pages/GameTopup";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path="/ai"><Redirect to="/" /></Route>
      <Route path={"/"} component={Home} />
      <Route path="/topup/:gameId" component={GameTopup} />
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
      <Route path={"/checkout/:orderId"} component={Checkout} />
      <Route path={"/admin/media"} component={AdminMedia} />
      <Route path={"/admin/package-artwork"} component={AdminPackageArtwork} />
      <Route path={"/admin/provider-security"} component={AdminProviderSecurity} />
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
          <StorefrontHeaderProvider><SelectedProductProvider><Router /></SelectedProductProvider></StorefrontHeaderProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

import { Reveal } from "@/components/Reveal";
import StorefrontLayout from "@/components/StorefrontLayout";
import { Home } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <StorefrontLayout>
      <main className="container flex min-h-[60vh] items-center justify-center py-10 zp-page">
        <Reveal as="section" index={0}>
          <article className="surface mx-auto w-full max-w-lg rounded-3xl p-8 text-center sm:p-10">
            <p className="font-display text-5xl font-extrabold text-neon">404</p>
            <h1 className="mt-3 font-display text-2xl font-bold text-ink">រកមិនឃើញទំព័រនេះ</h1>
            <p className="mt-3 text-sm leading-6 text-ink-muted">
              ទំព័រនេះមិនមាន ឬត្រូវបានផ្លាស់ទី។ សូមត្រឡប់ទៅហាង ដើម្បីជ្រើសហ្គេម។
            </p>
            <div id="not-found-button-group" className="mt-6 flex justify-center">
              <Link href="/" className="zbtn zbtn--primary inline-flex h-11 items-center gap-2 px-5">
                <Home className="h-4 w-4" />
                ត្រឡប់ទៅទំព័រដើម
              </Link>
            </div>
          </article>
        </Reveal>
      </main>
    </StorefrontLayout>
  );
}

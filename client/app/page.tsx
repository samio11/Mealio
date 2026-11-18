import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  Camera,
  CheckCircle2,
  ChefHat,
  CircleDollarSign,
  Landmark,
  ListChecks,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";

import { ProductPreview } from "@/components/landing/product-preview";
import { SiteNav } from "@/components/landing/site-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";

const FEATURES = [
  {
    icon: UtensilsCrossed,
    title: "Meals and daily menu",
    body: "Members switch their own breakfast, lunch and dinner on or off before the cut-off. Publish the day's menu and notices in Bangla or English.",
  },
  {
    icon: ShoppingBasket,
    title: "Bazar that adds up",
    body: "Record grocery purchases line by line with quantity, unit and price. Approved bazar becomes a verified expense automatically.",
  },
  {
    icon: Sparkles,
    title: "AI-assisted bazar photos",
    body: "Upload a shopping photo and get a suggested list of items and prices to review. Nothing is posted until a person confirms it.",
  },
  {
    icon: CalendarClock,
    title: "Fair bazar duty",
    body: "Rotate duty days evenly across members, avoid back-to-back turns, and swap or reassign with a recorded reason.",
  },
  {
    icon: CircleDollarSign,
    title: "Deposits and expenses",
    body: "Members submit deposits; the manager verifies them. Shared bills like rent, gas and WiFi are split the way you choose.",
  },
  {
    icon: BarChart3,
    title: "Balances and reports",
    body: "See the meal rate, each member's cost, who owes what, and save a polished monthly report as PDF.",
  },
  {
    icon: Users,
    title: "Multiple messes, one account",
    body: "Manage more than one mess and switch between them. Your role and permissions are separate in each mess.",
  },
  {
    icon: Camera,
    title: "Evidence, or manual entry",
    body: "Attach photos when you have them. Quantities and prices you cannot prove are simply typed in by hand — the app never guesses.",
  },
];

const STEPS = [
  {
    icon: Users,
    title: "Create your mess",
    body: "Add the mess name and area, then invite the other residents by email or phone number.",
  },
  {
    icon: ChefHat,
    title: "Set up the month",
    body: "Set the budget, opening cash, which meals are served and the daily cut-off times.",
  },
  {
    icon: ListChecks,
    title: "Record as you go",
    body: "Members mark meals, the bazar buyer submits shopping, and deposits are added when money changes hands.",
  },
  {
    icon: Landmark,
    title: "Verify and settle",
    body: "The manager approves expenses and verifies deposits, then everyone sees an exact balance for the month.",
  },
];

const FAQS = [
  {
    q: "Is Mealio free?",
    a: "Yes. The app is free to use while we run our pilot with real messes. There are no plans, no trials and no payment details to enter.",
  },
  {
    q: "Does the AI guess my shopping prices?",
    a: "No. A photo can suggest items, but quantity and price are only used when they are actually visible. Anything uncertain is left blank and marked for you to type in. AI never approves or posts a transaction.",
  },
  {
    q: "How is the meal rate calculated?",
    a: "Total approved meal and bazar expenses for the month divided by the total number of counted meals. Each member's meal cost is their own meal count multiplied by that rate. Rent and utility bills are kept separate and never folded into the meal rate.",
  },
  {
    q: "Can I keep records for past months?",
    a: "Yes. Settings are snapshotted per month, so changing a future month's configuration never rewrites the reports of earlier months.",
  },
  {
    q: "Can several people manage the same mess?",
    a: "Yes. A mess can have more than one manager, and every mess keeps at least one active manager at all times.",
  },
  {
    q: "What if my internet is slow?",
    a: "The interface is mobile-first and light, so it works on an ordinary mobile connection. Every number is entered once and stored safely on the server.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteNav />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative border-b">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-b from-primary/6 to-transparent"
          />
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-14 lg:py-20">
            <div className="space-y-6">
              <Badge variant="secondary" className="gap-1.5">
                <Sparkles className="size-3.5" />
                Free during our pilot
              </Badge>
              <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                Your mess accounts, settled without the arguments
              </h1>
              <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
                Mealio keeps meals, bazar shopping, deposits and shared bills in one place — then works out the
                meal rate and every member&apos;s balance for the month. Built in Bangla and English for messes in
                Bangladesh.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/sign-up">
                    Create your mess
                    <ArrowRight />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/sign-in">I already have an account</Link>
                </Button>
              </div>
              <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                {["Taka (৳) throughout", "Asia/Dhaka cut-off times", "No billing details"].map((item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-success" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <ProductPreview />
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-b scroll-mt-16">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
            <div className="max-w-2xl space-y-3">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Everything a shared mess needs</h2>
              <p className="text-muted-foreground">
                One mess, one set of records. Each mess has its own members, months, grocery catalogue and ledger, and
                nothing is shared between messes.
              </p>
            </div>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((feature) => (
                <Card key={feature.title} className="h-full">
                  <CardContent className="space-y-3 pt-5">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <feature.icon className="size-4.5" />
                    </span>
                    <h3 className="text-sm font-semibold">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-b scroll-mt-16">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
            <div className="max-w-2xl space-y-3">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">How mess management works here</h2>
              <p className="text-muted-foreground">
                The flow follows how a mess actually runs: someone cooks, someone shops, everyone pays, and at the end of
                the month the numbers have to agree.
              </p>
            </div>

            <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, index) => (
                <li key={step.title} className="relative rounded-xl border bg-card p-5">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-muted-foreground">
                    {index + 1}
                  </span>
                  <h3 className="mt-3 flex items-center gap-2 text-sm font-semibold">
                    <step.icon className="size-4 text-primary" />
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Examples */}
        <section id="examples" className="border-b scroll-mt-16">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
              <div className="space-y-3">
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">A worked example in taka</h2>
                <p className="text-muted-foreground">
                  Five members, one month, 1,000 counted meals. The meal rate is the approved meal and bazar spending
                  divided by the meals actually eaten.
                </p>
                <Button asChild variant="outline">
                  <Link href="/sign-up">
                    Try it with your own mess
                    <ArrowRight />
                  </Link>
                </Button>
              </div>

              <Card>
                <CardContent className="divide-y pt-5 text-sm">
                  {[
                    ["Approved meal & bazar expenses", "৳30,000"],
                    ["Total counted meals", "1,000"],
                    ["Meal rate", "৳30.00 per meal"],
                    ["A member who ate 75 meals", "৳2,250.00 owed"],
                    ["Their verified deposits", "৳3,000.00"],
                    ["Their balance", "৳750.00 credit"],
                  ].map(([label, value], index, all) => (
                    <div
                      key={label}
                      className={
                        index === all.length - 1
                          ? "flex items-center justify-between gap-4 py-3 font-medium"
                          : "flex items-center justify-between gap-4 py-3"
                      }
                    >
                      <span className={index === all.length - 1 ? "" : "text-muted-foreground"}>{label}</span>
                      <span className="tabular whitespace-nowrap">{value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-16">
          <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6 lg:py-20">
            <div className="space-y-3 text-center">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Questions people ask</h2>
              <p className="text-muted-foreground">Straight answers about how the money side works.</p>
            </div>

            <div className="mt-8 divide-y rounded-xl border bg-card">
              {FAQS.map((faq) => (
                <details key={faq.q} className="group px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium">
                    {faq.q}
                    <span className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="pt-2 text-sm text-muted-foreground">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t bg-muted/40">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-4 py-14 text-center sm:px-6">
            <Smartphone className="size-6 text-primary" />
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Start with the mess you live in</h2>
            <p className="max-w-xl text-muted-foreground">
              Set it up in a few minutes, invite the residents, and let the monthly numbers take care of themselves.
            </p>
            <Button asChild size="lg">
              <Link href="/sign-up">
                Get started
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2">
            <Logo className="size-7" />
            <span className="text-sm font-medium">Mealio</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Shared-mess management for Bangladesh · Taka (৳) · Asia/Dhaka
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link href="/sign-in" className="hover:text-foreground">
              Sign in
            </Link>
            <Link href="/sign-up" className="hover:text-foreground">
              Create account
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

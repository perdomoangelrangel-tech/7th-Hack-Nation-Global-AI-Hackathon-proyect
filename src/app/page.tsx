import { Suspense } from "react";
import { AskExample } from "@/components/landing/AskExample";
import { Fares } from "@/components/landing/Fares";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LiveCounters } from "@/components/landing/LiveCounters";
import { Nav } from "@/components/landing/Nav";
import { Odyssey } from "@/components/landing/Odyssey";
import { Riders } from "@/components/landing/Riders";
import { Scale } from "@/components/landing/Scale";
import { Team } from "@/components/landing/Team";
import { Videos } from "@/components/landing/Videos";

// Live counters read graph_stats at most once an hour (ISR). The rest of the page is static.
export const revalidate = 3600;

export default function Home() {
  return (
    <>
      <Nav />
      <main id="main">
        <Hero />
        <Odyssey />
        <HowItWorks />
        <AskExample />
        <Riders />
        <Fares />
        <Scale
          counters={
            <Suspense fallback={null}>
              <LiveCounters />
            </Suspense>
          }
        />
        <Videos />
        <Team />
      </main>
      <Footer />
    </>
  );
}

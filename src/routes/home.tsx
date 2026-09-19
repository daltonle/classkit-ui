import { ArrowRight, LayoutGrid, ShieldCheck, WifiOff } from "lucide-react";

const benefits = [
  {
    icon: LayoutGrid,
    title: "Plan the room visually",
    description:
      "Build clear seating arrangements around the way your class works.",
  },
  {
    icon: WifiOff,
    title: "Keep working offline",
    description:
      "Classkit is designed to save locally first, even when the network is unreliable.",
  },
  {
    icon: ShieldCheck,
    title: "Keep ownership simple",
    description:
      "Your classroom data will remain private to your connected Google account.",
  },
];

export function HomePage() {
  return (
    <main>
      <section className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold tracking-wide text-sky-700 uppercase">
            Classroom tools for teachers
          </p>
          <h1 className="mt-4 text-5xl font-bold tracking-tight text-balance sm:text-6xl">
            Shape a classroom where every student can thrive.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Classkit is a focused workspace for planning seating arrangements
            and managing the everyday details around your class.
          </p>
          <div className="mt-8 inline-flex items-center gap-2 rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-600">
            Sign-in arrives after the foundation review
            <ArrowRight aria-hidden="true" className="size-4" />
          </div>
        </div>
      </section>
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 md:grid-cols-3">
          {benefits.map(({ icon: Icon, title, description }) => (
            <article key={title}>
              <Icon aria-hidden="true" className="size-6 text-sky-700" />
              <h2 className="mt-4 font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {description}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

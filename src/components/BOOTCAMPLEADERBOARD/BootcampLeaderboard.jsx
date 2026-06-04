"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Medal,
  Minus,
  RefreshCw,
  Trophy,
  Users,
} from "lucide-react";
import InstitudeInfo from "@/data/global/institude.json";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/v1";

const columns = [
  { key: "rank", label: "Rank" },
  { key: "name", label: "Name" },
  { key: "batch", label: "Batch", hide: "hidden sm:table-cell" },
  { key: "attendance", label: "Attendance", hide: "hidden md:table-cell" },
  { key: "task", label: "Task", hide: "hidden md:table-cell" },
  { key: "contest", label: "Contest", hide: "hidden md:table-cell" },
  { key: "total", label: "Total" },
];

async function fetchLeaderboard() {
  const res = await fetch(`${API_BASE_URL}/bootcamp-leaderboard`);

  if (!res.ok) {
    throw new Error(`Leaderboard API error: ${res.status}`);
  }

  const json = await res.json();
  return json.data ?? [];
}

function RankBadge({ rank }) {
  if (rank <= 3) {
    const color =
      rank === 1
        ? "bg-[hsl(43_95%_50%)]"
        : rank === 2
          ? "bg-[hsl(220_12%_58%)]"
          : "bg-[hsl(25_80%_46%)]";

    return (
      <span
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${color} text-white shadow-sm`}
      >
        <Medal className="h-4 w-4" />
      </span>
    );
  }

  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
      {rank}
    </span>
  );
}

function PodiumCard({ participant, position, maxScore }) {
  const pct =
    maxScore > 0 ? Math.round((participant.total / maxScore) * 100) : 0;

  const config = {
    1: {
      glow: "bootcamp-rank-1-glow",
      color: "hsl(43 95% 50%)",
      label: "Champion",
      icon: <Trophy className="h-3.5 w-3.5" />,
      scoreClass: "bootcamp-shimmer-text",
      border: "border-[hsl(43_95%_50%/0.3)]",
    },
    2: {
      glow: "bootcamp-rank-2-glow",
      color: "hsl(220 12% 58%)",
      label: "Runner-up",
      icon: <Medal className="h-3.5 w-3.5" />,
      scoreClass: "",
      border: "border-[hsl(220_12%_58%/0.25)]",
    },
    3: {
      glow: "bootcamp-rank-3-glow",
      color: "hsl(25 80% 46%)",
      label: "2nd Runner-up",
      icon: <Medal className="h-3.5 w-3.5" />,
      scoreClass: "",
      border: "border-[hsl(25_80%_46%/0.25)]",
    },
  }[position];

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-2xl border bg-white ${config.border} ${config.glow} bootcamp-card-shadow transition-transform duration-300 hover:-translate-y-1`}
    >
      <div className="h-1.5 w-full" style={{ background: config.color }} />
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-4 flex items-center justify-between">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white"
            style={{ background: config.color }}
          >
            {config.icon} {config.label}
          </span>
          <span className="font-mono text-xs font-semibold text-slate-500">
            #{participant.rank}
          </span>
        </div>

        <p className="mb-0.5 text-xl font-bold leading-snug text-slate-950">
          {participant.name}
        </p>
        <p className="mb-5 text-xs text-slate-500">
          Batch {participant.batch}
        </p>

        <div
          className={`mb-4 text-5xl font-black ${config.scoreClass}`}
          style={!config.scoreClass ? { color: config.color } : undefined}
        >
          {participant.total}
          <span className="ml-1.5 text-sm font-medium text-slate-500">pts</span>
        </div>

        <div className="mb-4 h-1.5 w-full rounded-full bg-slate-100">
          <div
            className="h-1.5 rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: config.color }}
          />
        </div>

        <div className="mt-auto grid grid-cols-3 gap-2">
          {[
            { label: "Attend.", value: participant.attendance },
            { label: "Task", value: participant.task },
            { label: "Contest", value: participant.contest },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl bg-slate-100/70 py-2.5 text-center"
            >
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                {stat.label}
              </p>
              <p className="text-base font-bold text-slate-950">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SortIcon({ active, direction }) {
  if (!active) {
    return <Minus className="h-3 w-3 opacity-20" />;
  }

  return direction === "asc" ? (
    <ChevronUp className="h-3 w-3 text-header" />
  ) : (
    <ChevronDown className="h-3 w-3 text-header" />
  );
}

export default function BootcampLeaderboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [sortKey, setSortKey] = useState("rank");
  const [sortDir, setSortDir] = useState("asc");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const rows = await fetchLeaderboard();
      setData(rows);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 24 * 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const sorted = useMemo(() => {
    return [...data]
      .filter((participant) =>
        participant.name.toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => {
        const firstValue = a[sortKey];
        const secondValue = b[sortKey];

        if (
          typeof firstValue === "string" &&
          typeof secondValue === "string"
        ) {
          return sortDir === "asc"
            ? firstValue.localeCompare(secondValue)
            : secondValue.localeCompare(firstValue);
        }

        return sortDir === "asc"
          ? firstValue - secondValue
          : secondValue - firstValue;
      });
  }, [data, search, sortDir, sortKey]);

  const maxScore = data.length
    ? Math.max(...data.map((participant) => participant.total))
    : 1;
  const top3 = [...data]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 3);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDir("asc");
  };

  return (
    <main className="min-h-screen bg-[hsl(214_60%_97%)] text-slate-950">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        {/* <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <img
            src={InstitudeInfo.img}
            alt={InstitudeInfo.alt}
            className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-header/30"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xs font-bold leading-tight text-slate-950 sm:text-sm">
              Competitive Programming Camp - City University
            </h1>
            <p className="text-[10px] text-slate-500 sm:text-xs">
              Bootcamp Leaderboard
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-header/20 bg-header/10 px-3 py-1.5">
            <span className="bootcamp-live-dot h-2 w-2 rounded-full bg-header" />
            <span className="hidden text-xs font-semibold text-header sm:inline">
              Live
            </span>
          </div>
        </div> */}
      </header>

      <section className="relative overflow-hidden bg-header">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute right-0 top-0 h-64 w-64 -translate-y-1/2 translate-x-1/4 rounded-full bg-white opacity-10" />

        <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 py-10 text-center text-white sm:flex-row sm:gap-10 sm:py-14 sm:text-left">
          <img
            src={InstitudeInfo.img}
            alt={InstitudeInfo.alt}
            className="bootcamp-float h-24 w-24 shrink-0 rounded-full object-cover sm:h-32 sm:w-32"
            style={{
              boxShadow:
                "0 0 0 4px rgba(255,255,255,0.3), 0 8px 32px rgba(0,0,0,0.2)",
            }}
          />
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-semibold">
              <Trophy className="h-3.5 w-3.5" /> Final Rankings
            </div>
            <h2 className="mb-1 text-3xl font-black tracking-normal sm:text-5xl">
              Competitive Programming Bootcamp
            </h2>
            <p className="text-sm opacity-80 sm:text-base">
              {data.length > 0
                ? `${data.length} participants competing for the top spot`
                : "Loading participants..."}
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">Failed to load data</p>
              <p className="mt-0.5 text-xs opacity-80">{error}</p>
              <p className="mt-2 text-xs opacity-80">
                Add `GOOGLE_SHEETS_API_KEY` and `BOOTCAMP_SHEET_ID` to the
                server environment to connect the live sheet.
              </p>
            </div>
            <button
              type="button"
              onClick={load}
              className="shrink-0 text-xs font-semibold underline"
            >
              Retry
            </button>
          </div>
        )}

        {loading && (
          <div className="mb-8 space-y-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-28 animate-pulse rounded-2xl bg-slate-200"
              />
            ))}
          </div>
        )}

        {!loading && data.length > 0 && (
          <>
            <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  icon: <Users className="h-5 w-5" />,
                  label: "Participants",
                  value: String(data.length),
                },
                {
                  icon: <Trophy className="h-5 w-5" />,
                  label: "Max Score",
                  value: String(maxScore),
                },
                {
                  icon: <Medal className="h-5 w-5" />,
                  label: "Champion",
                  value: top3[0]?.name.split(" ")[0] ?? "-",
                },
                {
                  icon: <Medal className="h-5 w-5" />,
                  label: "Runner-up",
                  value: top3[1]?.name.split(" ")[0] ?? "-",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bootcamp-card-shadow rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="mb-2 text-header">{stat.icon}</div>
                  <p className="mb-0.5 text-xs font-medium text-slate-500">
                    {stat.label}
                  </p>
                  <p className="truncate text-lg font-bold leading-tight text-slate-950">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            {top3.length === 3 && (
              <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
                <PodiumCard
                  participant={top3[1]}
                  position={2}
                  maxScore={maxScore}
                />
                <PodiumCard
                  participant={top3[0]}
                  position={1}
                  maxScore={maxScore}
                />
                <PodiumCard
                  participant={top3[2]}
                  position={3}
                  maxScore={maxScore}
                />
              </div>
            )}

            <div className="bootcamp-card-shadow overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-100/50 px-4 py-3 sm:flex-row sm:items-center">
                <div className="text-sm font-semibold text-slate-950">
                  Full Rankings
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                  <input
                    type="search"
                    placeholder="Search..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-header/30 sm:w-44"
                  />
                  {lastUpdated && (
                    <span className="whitespace-nowrap text-xs text-slate-500">
                      {lastUpdated.toLocaleTimeString()}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={load}
                    disabled={loading}
                    className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-slate-100 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${loading ? "animate-spin" : ""}`}
                    />
                    Refresh
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-header/5">
                      {columns.map((column) => (
                        <th
                          key={column.key}
                          onClick={() => handleSort(column.key)}
                          className={`cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-normal text-slate-500 transition-colors hover:text-slate-950 ${
                            column.hide ?? ""
                          }`}
                        >
                          <span className="inline-flex items-center gap-1">
                            {column.label}
                            <SortIcon
                              active={sortKey === column.key}
                              direction={sortDir}
                            />
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((participant, index) => {
                      const rowBg =
                        participant.rank === 1
                          ? "bg-[hsl(43_95%_50%/0.04)]"
                          : participant.rank === 2
                            ? "bg-[hsl(220_12%_58%/0.04)]"
                            : participant.rank === 3
                              ? "bg-[hsl(25_80%_46%/0.04)]"
                              : index % 2 === 0
                                ? ""
                                : "bg-slate-100/30";

                      return (
                        <tr
                          key={`${participant.name}-${participant.rank}`}
                          className={`bootcamp-table-row border-b border-slate-200/70 ${rowBg}`}
                        >
                          <td className="w-14 px-4 py-3">
                            <RankBadge rank={participant.rank} />
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-950">
                            <span
                              className={
                                participant.rank <= 3 ? "text-header" : ""
                              }
                            >
                              {participant.name}
                            </span>
                          </td>
                          <td className="hidden px-4 py-3 text-slate-500 sm:table-cell">
                            {participant.batch}
                          </td>
                          <td className="hidden px-4 py-3 font-mono text-slate-950 md:table-cell">
                            {participant.attendance}
                          </td>
                          <td className="hidden px-4 py-3 font-mono text-slate-950 md:table-cell">
                            {participant.task}
                          </td>
                          <td className="hidden px-4 py-3 font-mono text-slate-950 md:table-cell">
                            {participant.contest}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 font-bold text-slate-950">
                              {participant.total}
                              <span className="text-xs font-normal text-slate-500">
                                pts
                              </span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                    {sorted.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-16 text-center text-sm text-slate-500"
                        >
                          No participants found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <footer className="mt-12 border-t border-slate-200 pt-8 text-center">
          <img
            src={InstitudeInfo.img}
            alt={InstitudeInfo.alt}
            className="mx-auto mb-3 h-12 w-12 rounded-full object-cover opacity-70"
          />
          <p className="text-xs font-medium text-slate-500">
            Competitive Programming Camp City University
          </p>
        </footer>
      </section>
    </main>
  );
}

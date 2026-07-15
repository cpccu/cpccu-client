"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Hash, User, IdCard, Loader2, AlertCircle } from "lucide-react";
import { CertificateCard } from "./certificate-card";
import { useLazyVerifyCertificateQuery } from "@/features/certificate/certificateApi";
import { getCertificatesFromResponse } from "@/lib/certificates";

const SEARCH_TYPES = [
  {
    value: "id",
    label: "Certificate ID",
    Icon: Hash,
    placeholder: "e.g. CPCCU-2026-001",
  },
  {
    value: "name",
    label: "Recipient Name",
    Icon: User,
    placeholder: "e.g. Arif Hossain",
  },
  {
    value: "studentId",
    label: "Student ID",
    Icon: IdCard,
    placeholder: "e.g. CSE-2021-101",
  },
];

export function VerifyForm({ initialCertificateId }) {
  const [verifyCertificate, { isFetching }] = useLazyVerifyCertificateQuery();

  const [searchType, setSearchType] = useState("id");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const initialSearchRef = useRef(false);

  const currentType = SEARCH_TYPES.find((t) => t.value === searchType);

  useEffect(() => {
    if (initialCertificateId && !initialSearchRef.current) {
      initialSearchRef.current = true;
      setSearchType("id");
      setQuery(initialCertificateId);

      verifyCertificate({ certificateId: initialCertificateId }).then((res) => {
        if (res?.error) {
          setError(res.error?.data?.message || "Certificate not found.");
          setResults([]);
          setSearched(true);
          return;
        }

        const certificateResults = getCertificatesFromResponse(res?.data || {});

        if (!certificateResults.length) {
          setError("Certificate not found.");
          setResults([]);
          setSearched(true);
          return;
        }

        setResults(certificateResults);
        setSearched(true);
      }).catch(() => {
        setError("Something went wrong. Please try again.")
        setResults([]);
        setSearched(true);
      });
    }
  }, [initialCertificateId, verifyCertificate]);

  const handleSearch = async (e) => {
    e.preventDefault();

    if (!query.trim() || query.trim().length < 2) {
      setError("Please enter at least 2 characters to search.");
      return;
    }

    setError(null);
    setResults([]);
    setSearched(false);

    try {
      let payload = {};

      if (searchType === "id") {
        payload = { certificateId: query.trim() };
      } else if (searchType === "name") {
        payload = { recipientName: query.trim() };
      } else if (searchType === "studentId") {
        payload = { recipientId: query.trim() };
      }

      const res = await verifyCertificate(payload);

      if (res?.error) {
        setError(res.error?.data?.message || "Certificate not found.");
        setResults([]);
        setSearched(true);
        return;
      }

      const certificateResults = getCertificatesFromResponse(res?.data || {});

      if (!certificateResults.length) {
        setError("Certificate not found.");
        setResults([]);
        setSearched(true);
        return;
      }

      setResults(certificateResults);
      setSearched(true);
    } catch (err) {
      setError("Something went wrong. Please try again.")
      setResults([]);
      setSearched(true);
    }
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setError(null);
    setSearched(false);
  };

  return (
    <div className="space-y-6">
      {/* Search type tabs - Desktop original, Mobile optimized */}
      <div className="flex gap-1.5 rounded-xl bg-muted/50 border border-border/50 p-1.5 md:overflow-hidden overflow-x-auto">
        {SEARCH_TYPES.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setSearchType(value);
              handleClear();
            }}
            className={`flex-1 md:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap md:whitespace-normal flex-shrink-0 md:flex-shrink-1 ${
              searchType === value
                ? "bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/25"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden md:inline">{label}</span>
            <span className="md:hidden">{label.split(" ")[0]}</span>
          </button>
        ))}
      </div>

      {/* Search form */}
      <form onSubmit={handleSearch} className="space-y-4">
        {/* Input field */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
            <currentType.Icon className="w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          </div>

          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={currentType.placeholder}
            className="w-full bg-muted/50 border-2 border-border/60 rounded-xl pl-12 pr-4 py-4 text-base font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:bg-muted/80 focus:shadow-lg focus:shadow-primary/10 transition-all"
            autoComplete="off"
          />
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-3 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={isFetching || !query.trim()}
          className="w-full flex items-center justify-center gap-2.5 px-6 py-4 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.01] active:scale-[0.99] transition-all"
        >
          {isFetching ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              <Search className="w-5 h-5" />
              Verify Certificate
            </>
          )}
        </button>
      </form>

      {/* Results section */}
      {searched && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground font-medium">
              {results.length === 0
                ? "No certificates found"
                : `${results.length} certificate${results.length > 1 ? "s" : ""} found`}
            </p>

            <button
              type="button"
              onClick={handleClear}
              className="text-xs font-semibold text-primary hover:text-accent transition-colors"
            >
              Clear Search
            </button>
          </div>

          {results.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border bg-card/50 p-10 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-muted/80 flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8 text-muted-foreground" />
              </div>

              <p className="font-bold text-lg text-foreground">
                Certificate Not Found
              </p>

              <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                We could not find any certificate matching your search. Please
                double-check the details and try again.
              </p>

              <p className="text-xs text-muted-foreground font-mono bg-muted inline-block px-4 py-2 rounded-lg">
                Searched: &quot;{query}&quot;
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {results.map((cert) => (
                <CertificateCard
                  key={cert._id || cert.certificateId}
                  certificate={cert}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

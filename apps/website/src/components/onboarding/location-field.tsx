import { env } from "@soundkit/env/web";
import { useAsyncDebouncedCallback } from "@tanstack/react-pacer";
import { MapPin } from "lucide-react";
import RadarClient from "radar-sdk-js";
import type { RadarAutocompleteAddress } from "radar-sdk-js";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STATE_CODES = {
    alabama: "AL",
    alaska: "AK",
    arizona: "AZ",
    arkansas: "AR",
    california: "CA",
    colorado: "CO",
    connecticut: "CT",
    delaware: "DE",
    florida: "FL",
    georgia: "GA",
    hawaii: "HI",
    idaho: "ID",
    illinois: "IL",
    indiana: "IN",
    iowa: "IA",
    kansas: "KS",
    kentucky: "KY",
    louisiana: "LA",
    maine: "ME",
    maryland: "MD",
    massachusetts: "MA",
    michigan: "MI",
    minnesota: "MN",
    mississippi: "MS",
    missouri: "MO",
    montana: "MT",
    nebraska: "NE",
    nevada: "NV",
    "new hampshire": "NH",
    "new jersey": "NJ",
    "new mexico": "NM",
    "new york": "NY",
    "north carolina": "NC",
    "north dakota": "ND",
    ohio: "OH",
    oklahoma: "OK",
    oregon: "OR",
    pennsylvania: "PA",
    "rhode island": "RI",
    "south carolina": "SC",
    "south dakota": "SD",
    tennessee: "TN",
    texas: "TX",
    utah: "UT",
    vermont: "VT",
    virginia: "VA",
    washington: "WA",
    "west virginia": "WV",
    wisconsin: "WI",
    wyoming: "WY",
  } as const,
  VALID_STATE_CODES = new Set<string>(Object.values(STATE_CODES));

interface LocationSuggestion {
  city: string;
  id: string;
  label: string;
  stateCode: string;
}

const manualLocation = (value: string) => {
    const [city, state] = value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (!(city && state)) {
      return null;
    }
    const normalizedState = state.toLowerCase(),
      stateCode =
        STATE_CODES[normalizedState as keyof typeof STATE_CODES] ??
        state.toUpperCase();
    return VALID_STATE_CODES.has(stateCode) ? { city, state: stateCode } : null;
  },
  addressCity = (address: RadarAutocompleteAddress) =>
    address.city ?? address.placeLabel ?? address.addressLabel,
  addressState = (address: RadarAutocompleteAddress) => {
    const stateCode = address.stateCode?.toUpperCase();
    if (stateCode && VALID_STATE_CODES.has(stateCode)) {
      return stateCode;
    }
    return address.state
      ? STATE_CODES[address.state.toLowerCase() as keyof typeof STATE_CODES]
      : undefined;
  };

export function LocationField({
  city,
  onChange,
  state,
}: {
  city: string;
  onChange: (location: { city: string; query: string; state: string }) => void;
  state: string;
}) {
  const [query, setQuery] = useState(city && state ? `${city}, ${state}` : ""),
    [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]),
    [status, setStatus] = useState("idle"),
    requestIdRef = useRef(0),
    initializedRef = useRef(false),
    ensureRadar = () => {
      if (initializedRef.current) {
        return true;
      }
      if (!env.VITE_RADAR_PUBLISHABLE_KEY) {
        return false;
      }
      RadarClient.initialize(env.VITE_RADAR_PUBLISHABLE_KEY);
      initializedRef.current = true;
      return true;
    },
    search = useAsyncDebouncedCallback(
      async (value: string, requestId: number) => {
        if (!ensureRadar()) {
          const manual = manualLocation(value);
          setSuggestions([]);
          if (manual) {
            onChange({ ...manual, query: value });
            setStatus("manual");
          } else {
            setStatus("config");
          }
          return;
        }
        try {
          const result = await RadarClient.autocomplete(
            {
              countryCode: "US",
              layers: ["locality", "place"],
              limit: 6,
              query: value,
            },
            `onboarding-location-${requestId}`
          );
          if (requestId !== requestIdRef.current) {
            return;
          }
          const nextSuggestions = result.addresses.flatMap((address) => {
            const nextCity = addressCity(address),
              nextState = addressState(address),
              country = address.countryCode?.toUpperCase();
            if (!(nextCity && nextState && country === "US")) {
              return [];
            }
            return [
              {
                city: nextCity,
                id: `${nextCity}-${nextState}-${address.latitude}-${address.longitude}`,
                label: `${nextCity}, ${nextState}`,
                stateCode: nextState,
              },
            ];
          });
          setSuggestions(nextSuggestions);
          if (nextSuggestions.length === 0) {
            const manual = manualLocation(value);
            if (manual) {
              onChange({ ...manual, query: value });
              setStatus("manual");
            } else {
              setStatus("empty");
            }
          } else {
            setStatus("ready");
          }
        } catch {
          const manual = manualLocation(value);
          setSuggestions([]);
          if (manual) {
            onChange({ ...manual, query: value });
            setStatus("manual");
          } else {
            setStatus("error");
          }
        }
      },
      { wait: 350 }
    );

  useEffect(() => {
    const value = query.trim(),
      requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (value.length < 3) {
      setSuggestions([]);
      setStatus(value ? "idle" : "empty");
      return;
    }
    setStatus("searching");
    void search(value, requestId);
  }, [query, search]);

  return (
    <div className="space-y-2">
      <Label htmlFor="onboarding-location">Location</Label>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-autocomplete="list"
          aria-expanded={suggestions.length > 0}
          className="h-12 bg-background pl-10"
          id="onboarding-location"
          onChange={(event) => {
            setQuery(event.target.value);
            setSuggestions([]);
          }}
          placeholder="Little Rock, AR"
          required
          value={query}
        />
        {suggestions.length > 0 ? (
          <div className="absolute z-20 mt-2 w-full rounded-md border border-border bg-popover p-1 shadow-xl">
            {suggestions.map((suggestion) => (
              <button
                className="flex min-h-11 w-full flex-col rounded-sm px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none"
                key={suggestion.id}
                onClick={() => {
                  setQuery(suggestion.label);
                  setSuggestions([]);
                  setStatus("selected");
                  onChange({
                    city: suggestion.city,
                    query: suggestion.label,
                    state: suggestion.stateCode,
                  });
                }}
                type="button"
              >
                <span className="font-medium">{suggestion.label}</span>
                <span className="text-xs text-muted-foreground">
                  United States
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <p
        className={`text-xs ${status === "selected" || status === "manual" ? "text-emerald-400" : (status === "ready" || status === "searching" ? "text-muted-foreground" : "text-destructive")}`}
      >
        {status === "searching" && "Searching verified places…"}
        {status === "ready" && "Choose a city from the results."}
        {status === "selected" && `Verified ${city}, ${state}.`}
        {status === "manual" && "Using your city and state."}
        {status === "config" &&
          "Enter a city and valid state code, such as Austin, TX."}
        {status === "empty" && "Enter a city and state to continue."}
        {status === "error" &&
          "Location lookup is unavailable. Try City, ST format."}
        {status === "idle" && "Use a full city and state."}
      </p>
    </div>
  );
}

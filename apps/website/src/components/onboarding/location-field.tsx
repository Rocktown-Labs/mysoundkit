/* oxlint-disable immutability, no-empty-function, one-var, react/set-state-in-effect, sort-vars, jsx-a11y/prefer-tag-over-role */

import { env } from "@soundkit/env/web";
import { useAsyncDebouncedCallback } from "@tanstack/react-pacer";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  normalizeLocationComponents,
  parseManualLocation,
} from "@/lib/location-normalization";

interface LocationValue {
  city: string;
  country: string;
  query: string;
  state: string;
}

interface LocationFieldProps {
  city: string;
  country: string;
  onChange: (location: LocationValue) => void;
  state: string;
}

interface LocationSuggestion {
  id: string;
  label: string;
  prediction: google.maps.places.PlacePrediction;
  secondaryLabel: string;
}

type LocationStatus =
  | "config"
  | "empty"
  | "error"
  | "idle"
  | "manual"
  | "ready"
  | "searching"
  | "selected"
  | "selecting";

const MIN_QUERY_LENGTH = 3,
  displayValue = ({
    city,
    country,
    state,
  }: Pick<LocationFieldProps, "city" | "country" | "state">) =>
    [city, state, country].filter(Boolean).join(", ");

function LocationInput({ city, country, onChange, state }: LocationFieldProps) {
  const places = useMapsLibrary("places"),
    [query, setQuery] = useState(displayValue({ city, country, state })),
    [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]),
    [status, setStatus] = useState<LocationStatus>("idle"),
    [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1),
    [selectedLabel, setSelectedLabel] = useState(""),
    requestIdRef = useRef(0),
    sessionTokenRef =
      useRef<google.maps.places.AutocompleteSessionToken | null>(null),
    search = useAsyncDebouncedCallback(
      async (value: string, requestId: number) => {
        if (!places) {
          if (requestId !== requestIdRef.current) {
            return;
          }
          const manual = parseManualLocation(value);
          setSuggestions([]);
          setActiveSuggestionIndex(-1);
          if (manual) {
            setSelectedLabel(manual.query);
            onChange(manual);
            setStatus("manual");
          } else {
            setStatus("config");
          }
          return;
        }

        try {
          if (!sessionTokenRef.current) {
            sessionTokenRef.current = new places.AutocompleteSessionToken();
          }
          const result =
            await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
              includedPrimaryTypes: ["(regions)"],
              input: value,
              language: "en",
              region: "us",
              sessionToken: sessionTokenRef.current,
            });

          if (requestId !== requestIdRef.current) {
            return;
          }

          const nextSuggestions = result.suggestions.flatMap((suggestion) => {
            const prediction = suggestion.placePrediction;
            if (!prediction) {
              return [];
            }

            return [
              {
                id: prediction.placeId,
                label: prediction.text.text,
                prediction,
                secondaryLabel: prediction.secondaryText?.text ?? "",
              },
            ];
          });

          setSuggestions(nextSuggestions);
          setActiveSuggestionIndex(-1);
          if (nextSuggestions.length > 0) {
            setStatus("ready");
            return;
          }

          const manual = parseManualLocation(value);
          if (manual) {
            setSelectedLabel(manual.query);
            onChange(manual);
            setStatus("manual");
          } else {
            setStatus("empty");
          }
        } catch {
          if (requestId !== requestIdRef.current) {
            return;
          }
          const manual = parseManualLocation(value);
          setSuggestions([]);
          setActiveSuggestionIndex(-1);
          if (manual) {
            setSelectedLabel(manual.query);
            onChange(manual);
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

    if (!value) {
      setSuggestions([]);
      setStatus("empty");
      return;
    }
    if (value.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setStatus("idle");
      return;
    }
    if (!places) {
      setStatus("searching");
      void search(value, requestId);
      return;
    }
    setStatus("searching");
    void search(value, requestId);
  }, [places, query, search]);

  const selectSuggestion = async (suggestion: LocationSuggestion) => {
    if (!places) {
      return;
    }

    setStatus("selecting");
    try {
      const place = suggestion.prediction.toPlace();
      await place.fetchFields({ fields: ["addressComponents"] });
      const location = normalizeLocationComponents(
        place.addressComponents ?? []
      );

      sessionTokenRef.current = null;
      setSuggestions([]);
      setActiveSuggestionIndex(-1);

      if (location) {
        setQuery(suggestion.label);
        setSelectedLabel(suggestion.label);
        setStatus("selected");
        onChange({ ...location, query: suggestion.label });
        return;
      }

      const manual = parseManualLocation(suggestion.label);
      if (manual) {
        setQuery(manual.query);
        setSelectedLabel(manual.query);
        setStatus("manual");
        onChange(manual);
        return;
      }

      setStatus("error");
    } catch {
      sessionTokenRef.current = null;
      setSuggestions([]);
      setActiveSuggestionIndex(-1);
      const manual = parseManualLocation(suggestion.label);
      if (manual) {
        setQuery(manual.query);
        setSelectedLabel(manual.query);
        setStatus("manual");
        onChange(manual);
      } else {
        setStatus("error");
      }
    }
  };

  return (
    <LocationFieldFrame
      activeSuggestionIndex={activeSuggestionIndex}
      city={city}
      country={country}
      onInput={(value) => {
        setQuery(value);
        setSelectedLabel("");
        setSuggestions([]);
        setActiveSuggestionIndex(-1);
        onChange({ city: "", country: "", query: value, state: "" });
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" && suggestions.length > 0) {
          event.preventDefault();
          setActiveSuggestionIndex((index) =>
            Math.min(index + 1, suggestions.length - 1)
          );
        }
        if (event.key === "ArrowUp" && suggestions.length > 0) {
          event.preventDefault();
          setActiveSuggestionIndex((index) => Math.max(index - 1, 0));
        }
        if (event.key === "Escape") {
          setSuggestions([]);
          setActiveSuggestionIndex(-1);
        }
        if (event.key === "Enter" && activeSuggestionIndex >= 0) {
          event.preventDefault();
          selectSuggestion(suggestions[activeSuggestionIndex]);
        }
      }}
      onSelectSuggestion={selectSuggestion}
      placeholder="Little Rock, AR or Paris, France"
      query={query}
      selectedLabel={selectedLabel}
      state={state}
      status={status}
      suggestions={suggestions}
    />
  );
}

function manualStatusFor(
  query: string,
  parsed: ReturnType<typeof parseManualLocation>
): LocationStatus {
  if (parsed) {
    return "manual";
  }
  return query ? "config" : "empty";
}

function ManualLocationInput({
  city,
  country,
  onChange,
  state,
}: LocationFieldProps) {
  const [query, setQuery] = useState(displayValue({ city, country, state })),
    parsed = parseManualLocation(query);

  return (
    <LocationFieldFrame
      activeSuggestionIndex={-1}
      city={city}
      country={country}
      onInput={(value) => {
        setQuery(value);
        const location = parseManualLocation(value);
        onChange(
          location ?? {
            city: "",
            country: "",
            query: value,
            state: "",
          }
        );
      }}
      onKeyDown={() => {}}
      onSelectSuggestion={() => {}}
      placeholder="Little Rock, AR or Paris, France"
      query={query}
      selectedLabel={parsed?.query ?? ""}
      state={state}
      status={manualStatusFor(query, parsed)}
      suggestions={[]}
    />
  );
}

function statusMessageFor(
  status: LocationStatus,
  selectedLabel: string,
  city: string,
  state: string,
  country: string
) {
  switch (status) {
    case "searching": {
      return "Searching global locations…";
    }
    case "selecting": {
      return "Checking that location…";
    }
    case "ready": {
      return "Choose a city or region from the results.";
    }
    case "selected": {
      return `Verified ${selectedLabel || [city, state, country].filter(Boolean).join(", ")}.`;
    }
    case "manual": {
      return "Using the entered city and region.";
    }
    case "config": {
      return "Location search is unavailable. Enter City, Region, Country to continue.";
    }
    case "empty": {
      return "Enter a city and region to continue.";
    }
    case "error": {
      return "Location search failed. Enter City, Region, Country to continue.";
    }
    default: {
      return "Use a city and region, not a street address.";
    }
  }
}

function statusClassFor(status: LocationStatus, isBusy: boolean) {
  if (status === "selected" || status === "manual") {
    return "text-emerald-400";
  }
  if (status === "ready" || isBusy) {
    return "text-muted-foreground";
  }
  return "text-destructive";
}

function LocationFieldFrame({
  activeSuggestionIndex,
  city,
  country,
  onInput,
  onKeyDown,
  onSelectSuggestion,
  placeholder,
  query,
  selectedLabel,
  state,
  status,
  suggestions,
}: {
  activeSuggestionIndex: number;
  city: string;
  country: string;
  onInput: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onSelectSuggestion: (suggestion: LocationSuggestion) => void;
  placeholder: string;
  query: string;
  selectedLabel: string;
  state: string;
  status: LocationStatus;
  suggestions: LocationSuggestion[];
}) {
  const isBusy = status === "searching" || status === "selecting",
    statusMessage = statusMessageFor(
      status,
      selectedLabel,
      city,
      state,
      country
    );

  return (
    <div className="space-y-2">
      <Label htmlFor="onboarding-location">Location</Label>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-activedescendant={
            activeSuggestionIndex >= 0
              ? `onboarding-location-option-${activeSuggestionIndex}`
              : undefined
          }
          aria-autocomplete="list"
          aria-busy={isBusy}
          aria-controls="onboarding-location-suggestions"
          aria-expanded={suggestions.length > 0}
          autoComplete="off"
          className="h-12 bg-background pl-10"
          id="onboarding-location"
          onChange={(event) => onInput(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          required
          role="combobox"
          value={query}
        />
        {suggestions.length > 0 ? (
          <div
            className="absolute z-20 mt-2 w-full rounded-md border border-border bg-popover p-1 shadow-xl"
            id="onboarding-location-suggestions"
            role="listbox"
          >
            {suggestions.map((suggestion, index) => (
              <button
                aria-selected={index === activeSuggestionIndex}
                className="flex min-h-11 w-full flex-col rounded-sm px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none"
                id={`onboarding-location-option-${index}`}
                key={suggestion.id}
                onClick={() => onSelectSuggestion(suggestion)}
                role="option"
                type="button"
              >
                <span className="font-medium">{suggestion.label}</span>
                {suggestion.secondaryLabel ? (
                  <span className="text-xs text-muted-foreground">
                    {suggestion.secondaryLabel}
                  </span>
                ) : null}
              </button>
            ))}
            <div className="flex justify-end border-t border-border/60 px-2 pt-2">
              <img
                alt="Powered by Google"
                className="h-[18px] w-auto"
                height="18"
                src="/powered-by-google.png"
                width="59"
              />
            </div>
          </div>
        ) : null}
      </div>
      <p className={`text-xs ${statusClassFor(status, isBusy)}`}>
        {statusMessage}
      </p>
    </div>
  );
}

export function LocationField(props: LocationFieldProps) {
  if (!env.VITE_GOOGLE_MAPS_API_KEY) {
    return <ManualLocationInput {...props} />;
  }

  return (
    <APIProvider
      apiKey={env.VITE_GOOGLE_MAPS_API_KEY}
      language="en"
      libraries={["places"]}
      region="US"
      solutionChannel="gmp_git_agentskills_v1"
    >
      <LocationInput {...props} />
    </APIProvider>
  );
}

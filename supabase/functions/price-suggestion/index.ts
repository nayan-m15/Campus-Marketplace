import { createClient } from "npm:@supabase/supabase-js@2";

const SERPAPI_URL = "https://serpapi.com/search.json";
const DEFAULT_LOCATION = "Johannesburg, South Africa";
const DEFAULT_CONDITION = "Good";
const CACHE_VERSION = "v4";
const IMAGE_SEARCH_TIMEOUT_MS = 5_000;
const SHOPPING_SEARCH_BUDGET_MS = 6_500;
const RESPONSE_GRACE_MS = 1_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const conditionFactors: Record<string, number> = {
  New: 0.9,
  "Like New": 0.75,
  Good: 0.6,
  Fair: 0.45,
  Poor: 0.3,
};

type PriceSuggestionRequest = {
  listingId?: string | number;
  query?: string;
  description?: string;
  category?: string;
  condition?: string;
  location?: string;
  listingPrice?: string | number;
  price?: string | number;
  imageUrl?: string;
  imageUrls?: string[];
};

type ShoppingResult = {
  title?: string;
  source?: string;
  price?: string;
  extracted_price?: number;
  link?: string;
  product_link?: string;
  thumbnail?: string;
};

type LensResult = {
  title?: string;
  source?: string;
};

type PricedShoppingResult = ShoppingResult & {
  extractedPrice: number;
};

type SearchCandidate = {
  level: string;
  label: string;
  query: string;
  matchTokens: string[];
  usedFallback: boolean;
};

type EvaluatedPricing = ReturnType<typeof evaluateShoppingResults>;

type PricingAttempt = {
  basis: SearchCandidate;
  pricing: EvaluatedPricing | null;
  sanity: ReturnType<typeof getSanityResult>;
  error?: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normaliseText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normaliseImageUrl(value: unknown) {
  const imageUrl = normaliseText(value);
  if (!imageUrl) return "";

  try {
    const url = new URL(imageUrl);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function normalisePrice(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  const rawPrice = normaliseText(value);
  if (!rawPrice) return null;

  const compact = rawPrice.replace(/\s/g, "");
  const numericText = compact
    .replace(/[^0-9.,]/g, "")
    .replace(/,(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const price = Number(numericText);

  return Number.isFinite(price) && price > 0 ? price : null;
}

async function hashText(value: string) {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function buildRequestFingerprint({
  searchQuery,
  condition,
  location,
  imageUrl,
  listingPrice,
}: {
  searchQuery: string;
  condition: string;
  location: string;
  imageUrl: string;
  listingPrice: number | null;
}) {
  const fingerprint = JSON.stringify({
    version: CACHE_VERSION,
    searchQuery: searchQuery.toLowerCase(),
    condition: condition.toLowerCase(),
    location: location.toLowerCase(),
    imageUrl,
    listingPrice,
  });

  return hashText(fingerprint);
}

function dedupeWords(text: string) {
  const seen = new Set<string>();

  return text
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .filter((word) => {
      const key = word.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(" ");
}

function buildSearchQuery(query: string, category: string, description: string) {
  const descriptionSnippet = description
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 12)
    .join(" ");

  return dedupeWords([query, category, descriptionSnippet].filter(Boolean).join(" "));
}

function findModelSignals(text: string) {
  const matches = text.match(/\b(?=[a-z0-9-]*\d)(?=[a-z0-9-]*[a-z])[a-z0-9]+(?:-[a-z0-9]+)*\b/gi) || [];
  return [...new Set(matches.map((match) => match.toUpperCase()))].slice(0, 5);
}

function findBrandSignals(text: string) {
  const knownBrands = [
    "acer",
    "apple",
    "asus",
    "canon",
    "casio",
    "dell",
    "epson",
    "hp",
    "huawei",
    "lenovo",
    "logitech",
    "mecer",
    "microsoft",
    "nike",
    "bose",
    "jbl",
    "lamborghini",
    "samsung",
    "sony",
    "texas instruments",
    "xiaomi",
  ];
  const lowerText = text.toLowerCase();

  return knownBrands
    .filter((brand) => lowerText.includes(brand))
    .map((brand) => brand.replace(/\b\w/g, (letter) => letter.toUpperCase()));
}

function hasSpecificText(text: string) {
  const usefulWords = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3);

  return usefulWords.length >= 3;
}

function getMeaningfulTokens(text: string) {
  const stopWords = new Set([
    "and",
    "for",
    "from",
    "good",
    "great",
    "item",
    "like",
    "new",
    "old",
    "only",
    "other",
    "poor",
    "sale",
    "sell",
    "the",
    "this",
    "used",
    "with",
  ]);

  return [
    ...new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length >= 4 && !stopWords.has(word)),
    ),
  ].slice(0, 10);
}

function extractLensTerms(lensData: Record<string, unknown>, originalTokens: string[]) {
  const resultGroups = [
    lensData.visual_matches,
    lensData.shopping_results,
    lensData.exact_matches,
  ].filter(Array.isArray) as LensResult[][];
  const tokenCounts = new Map<string, number>();
  const sourceTitles: string[] = [];
  const existingTokens = new Set(originalTokens.map((token) => token.toLowerCase()));

  for (const result of resultGroups.flat().slice(0, 12)) {
    const title = normaliseText(result.title);
    if (!title) continue;
    sourceTitles.push(title);

    for (const token of getMeaningfulTokens(`${title} ${result.source || ""}`)) {
      if (existingTokens.has(token)) continue;
      tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
    }
  }

  return {
    terms: [...tokenCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([token]) => token)
      .slice(0, 4),
    sourceTitles: sourceTitles.slice(0, 5),
  };
}

async function getImageSearchContext({
  serpApiKey,
  imageUrl,
  searchQuery,
  originalTokens,
}: {
  serpApiKey: string;
  imageUrl: string;
  searchQuery: string;
  originalTokens: string[];
}) {
  if (!imageUrl) {
    return {
      used: false,
      terms: [] as string[],
      sourceTitles: [] as string[],
    };
  }

  const params = new URLSearchParams({
    engine: "google_lens",
    api_key: serpApiKey,
    url: imageUrl,
    type: "products",
    country: "za",
    hl: "en",
    q: searchQuery,
    safe: "active",
  });

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error("Image search timed out."));
      }, IMAGE_SEARCH_TIMEOUT_MS);
    });

    const { lensResponse, lensData } = await Promise.race([
      (async () => {
        const lensResponse = await fetch(`${SERPAPI_URL}?${params.toString()}`, {
          signal: controller.signal,
        });
        const lensData = await lensResponse.json();

        return { lensResponse, lensData };
      })(),
      timeoutPromise,
    ]);

    if (!lensResponse.ok || lensData.error) {
      console.error("Google Lens image search failed:", lensData.error || lensResponse.statusText);
      return {
        used: true,
        terms: [] as string[],
        sourceTitles: [] as string[],
        error: lensData.error || "Image search failed.",
      };
    }

    const { terms, sourceTitles } = extractLensTerms(lensData, originalTokens);

    return {
      used: true,
      terms,
      sourceTitles,
    };
  } catch (error) {
    const timedOut = error instanceof Error &&
      (error.name === "AbortError" || error.message === "Image search timed out.");

    if (timedOut) {
      console.error(`Google Lens image search timed out after ${IMAGE_SEARCH_TIMEOUT_MS}ms.`);
    } else {
      console.error("Google Lens image search failed:", error);
    }

    return {
      used: true,
      terms: [] as string[],
      sourceTitles: [] as string[],
      error: timedOut ? "Image search timed out." : "Image search failed.",
    };
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

function countTokenMatches(result: ShoppingResult, tokens: string[]) {
  const resultText = `${result.title || ""} ${result.source || ""}`.toLowerCase();
  return tokens.filter((token) => resultText.includes(token)).length;
}

function titleHasNegativeSignal(result: ShoppingResult, category: string, listingText: string) {
  const resultText = `${result.title || ""} ${result.source || ""}`.toLowerCase();
  const sourceText = listingText.toLowerCase();
  const genericNegativeSignals = [
    "accessory",
    "case",
    "cover",
    "manual",
    "poster",
    "protector",
    "remote",
    "replacement",
    "skin",
    "stand",
  ];
  const vehicleNegativeSignals = [
    "1:18",
    "1:24",
    "1:32",
    "1:43",
    "1:64",
    "diecast",
    "hot wheels",
    "lego",
    "model car",
    "rc car",
    "scale model",
    "toy",
  ];
  const lowerCategory = category.toLowerCase();
  const negativeSignals = lowerCategory.includes("vehicle") || lowerCategory.includes("car")
    ? [...genericNegativeSignals, ...vehicleNegativeSignals]
    : genericNegativeSignals;

  return negativeSignals.find((signal) =>
    resultText.includes(signal) && !sourceText.includes(signal)
  ) || "";
}

function buildGenericFallbackTerms({
  query,
  category,
  brandSignals,
  modelSignals,
}: {
  query: string;
  category: string;
  brandSignals: string[];
  modelSignals: string[];
}) {
  const excludedTokens = new Set([
    ...brandSignals.flatMap((brand) => brand.toLowerCase().split(/\s+/)),
    ...modelSignals.flatMap((model) => model.toLowerCase().split(/[-\s]+/)),
  ]);

  return getMeaningfulTokens(`${query} ${category}`)
    .filter((token) => !excludedTokens.has(token))
    .slice(0, 4);
}

function buildSearchCandidates({
  searchQuery,
  query,
  category,
  brandSignals,
  modelSignals,
}: {
  searchQuery: string;
  query: string;
  category: string;
  brandSignals: string[];
  modelSignals: string[];
}) {
  const candidates: SearchCandidate[] = [
    {
      level: "exact_or_detailed",
      label: "detailed listing search",
      query: searchQuery,
      matchTokens: getMeaningfulTokens(`${query} ${category}`),
      usedFallback: false,
    },
  ];
  const genericTerms = buildGenericFallbackTerms({ query, category, brandSignals, modelSignals });
  const brandQuery = dedupeWords([brandSignals[0], ...genericTerms].filter(Boolean).join(" "));
  const categoryQuery = dedupeWords(
    [genericTerms.join(" "), category].filter(Boolean).join(" "),
  );

  if (
    brandSignals.length > 0 &&
    brandQuery &&
    brandQuery.toLowerCase() !== searchQuery.toLowerCase()
  ) {
    candidates.push({
      level: "brand_category",
      label: "brand and item type fallback",
      query: brandQuery,
      matchTokens: getMeaningfulTokens(brandQuery),
      usedFallback: true,
    });
  }

  if (categoryQuery && categoryQuery.toLowerCase() !== searchQuery.toLowerCase()) {
    candidates.push({
      level: "category_only",
      label: "item type fallback",
      query: categoryQuery,
      matchTokens: getMeaningfulTokens(categoryQuery),
      usedFallback: true,
    });
  }

  return candidates;
}

function getMinimumTokenMatches(tokens: string[], usedFallback: boolean) {
  if (tokens.length === 0) return 0;
  if (usedFallback) return 1;
  return tokens.length >= 3 ? 2 : 1;
}

function getSanityResult(listingPrice: number | null, suggestedPrice: number) {
  if (!listingPrice || suggestedPrice <= 0) {
    return { status: "ok", warning: "" };
  }

  const ratio = suggestedPrice / listingPrice;

  if (ratio < 0.05 || ratio > 20) {
    return {
      status: "extreme",
      warning: "Comparable prices are far away from the seller's listing price, so they may be for a different item type.",
    };
  }

  if (ratio < 0.33 || ratio > 3) {
    return {
      status: "moderate",
      warning: "Comparable prices differ meaningfully from the seller's listing price.",
    };
  }

  return { status: "ok", warning: "" };
}

async function fetchShoppingResults({
  serpApiKey,
  searchQuery,
  location,
}: {
  serpApiKey: string;
  searchQuery: string;
  location: string;
}) {
  const params = new URLSearchParams({
    engine: "google_shopping",
    q: searchQuery,
    api_key: serpApiKey,
    gl: "za",
    hl: "en",
    google_domain: "google.co.za",
    location,
    num: "20",
  });
  const serpResponse = await fetch(`${SERPAPI_URL}?${params.toString()}`);
  const serpData = await serpResponse.json();

  if (!serpResponse.ok || serpData.error) {
    throw new Error(serpData.error || "Failed to fetch shopping prices from SerpApi.");
  }

  return Array.isArray(serpData.shopping_results)
    ? serpData.shopping_results as ShoppingResult[]
    : [];
}

function evaluateShoppingResults({
  shoppingResults,
  basis,
  category,
  listingText,
}: {
  shoppingResults: ShoppingResult[];
  basis: {
    level: string;
    label: string;
    query: string;
    matchTokens: string[];
    usedFallback: boolean;
  };
  category: string;
  listingText: string;
}) {
  const pricedResults = shoppingResults
    .map((result) => ({ ...result, extractedPrice: parsePrice(result) }))
    .filter((result): result is PricedShoppingResult => result.extractedPrice !== null);
  const randResults = pricedResults.filter(looksLikeRand);
  const currencyResults = randResults.length > 0 ? randResults : pricedResults;
  const rejectedResults = currencyResults
    .map((result) => ({ result, reason: titleHasNegativeSignal(result, category, listingText) }))
    .filter(({ reason }) => reason);
  const cleanedResults = currencyResults.filter((result) =>
    !titleHasNegativeSignal(result, category, listingText)
  );
  const minimumMatches = getMinimumTokenMatches(basis.matchTokens, basis.usedFallback);
  const relevantResults = cleanedResults.filter((result) =>
    minimumMatches === 0 || countTokenMatches(result, basis.matchTokens) >= minimumMatches
  );
  const usableResults = relevantResults.length >= 2 ? relevantResults : cleanedResults;
  const prices = usableResults.map((result) => result.extractedPrice);
  const filteredPrices = removeOutliers(prices);

  return {
    pricedResults,
    currencyResults,
    rejectedResults,
    cleanedResults,
    relevantResults,
    usableResults,
    prices,
    filteredPrices,
  };
}

async function evaluateSearchCandidate({
  candidate,
  serpApiKey,
  location,
  category,
  listingText,
  listingPrice,
  conditionFactor,
}: {
  candidate: SearchCandidate;
  serpApiKey: string;
  location: string;
  category: string;
  listingText: string;
  listingPrice: number | null;
  conditionFactor: number;
}): Promise<PricingAttempt> {
  try {
    const shoppingResults = await fetchShoppingResults({
      serpApiKey,
      searchQuery: candidate.query,
      location,
    });
    const pricing = evaluateShoppingResults({
      shoppingResults,
      basis: candidate,
      category,
      listingText,
    });
    const candidateMedian = pricing.filteredPrices.length > 0
      ? roundToNearestFive(median(pricing.filteredPrices))
      : 0;
    const candidateSuggestedPrice = roundToNearestFive(candidateMedian * conditionFactor);

    return {
      basis: candidate,
      pricing,
      sanity: getSanityResult(listingPrice, candidateSuggestedPrice),
    };
  } catch (error) {
    return {
      basis: candidate,
      pricing: null,
      sanity: { status: "ok", warning: "" },
      error: error instanceof Error ? error.message : "Shopping search failed.",
    };
  }
}

function attemptIsUsable(attempt: PricingAttempt) {
  if (!attempt.pricing) return false;

  const hasRelevantMatches =
    attempt.basis.matchTokens.length < 2 || attempt.pricing.relevantResults.length > 0;

  return (
    attempt.pricing.filteredPrices.length > 0 &&
    hasRelevantMatches &&
    attempt.sanity.status !== "extreme"
  );
}

function attemptSummary(attempt: PricingAttempt) {
  return {
    level: attempt.basis.level,
    label: attempt.basis.label,
    searchQuery: attempt.basis.query,
    sampleSize: attempt.pricing?.filteredPrices.length || 0,
    relevantSampleSize: attempt.pricing?.relevantResults.length || 0,
    rejectedSampleSize: attempt.pricing?.rejectedResults.length || 0,
    sanityStatus: attempt.sanity.status,
    error: attempt.error,
  };
}

function selectBestPricingAttempt(attempts: PricingAttempt[]) {
  const priority: Record<string, number> = {
    exact_or_detailed: 0,
    brand_category: 1,
    category_only: 2,
  };

  return [...attempts]
    .sort((a, b) => (priority[a.basis.level] ?? 99) - (priority[b.basis.level] ?? 99))
    .find(attemptIsUsable) || null;
}

function delay(ms: number) {
  return new Promise<"timeout">((resolve) => {
    setTimeout(() => resolve("timeout"), ms);
  });
}

function startCandidateEvaluations({
  candidates,
  serpApiKey,
  location,
  category,
  listingText,
  listingPrice,
  conditionFactor,
}: {
  candidates: SearchCandidate[];
  serpApiKey: string;
  location: string;
  category: string;
  listingText: string;
  listingPrice: number | null;
  conditionFactor: number;
}) {
  return candidates.map((candidate, index) => ({
    index,
    candidate,
    promise: evaluateSearchCandidate({
      candidate,
      serpApiKey,
      location,
      category,
      listingText,
      listingPrice,
      conditionFactor,
    }),
  }));
}

async function collectCompletedAttempts(
  tasks: Array<{ index: number; candidate: SearchCandidate; promise: Promise<PricingAttempt> }>,
  budgetMs: number,
) {
  const settledAttempts: PricingAttempt[] = [];
  let acceptingAttempts = true;

  await Promise.race([
    Promise.all(
      tasks.map(({ promise }) =>
        promise.then((attempt) => {
          if (acceptingAttempts) {
            settledAttempts.push(attempt);
          }
        })
      ),
    ),
    delay(budgetMs),
  ]);
  acceptingAttempts = false;

  return settledAttempts.sort((a, b) => {
    const aIndex = tasks.find((task) => task.candidate?.query === a.basis.query)?.index ?? 0;
    const bIndex = tasks.find((task) => task.candidate?.query === b.basis.query)?.index ?? 0;
    return aIndex - bIndex;
  });
}

async function settleAllAttempts(
  tasks: Array<{ index: number; candidate: SearchCandidate; promise: Promise<PricingAttempt> }>,
) {
  const attempts = await Promise.all(tasks.map(({ promise }) => promise));
  return attempts.sort((a, b) => {
    const aIndex = tasks.find((task) => task.candidate?.query === a.basis.query)?.index ?? 0;
    const bIndex = tasks.find((task) => task.candidate?.query === b.basis.query)?.index ?? 0;
    return aIndex - bIndex;
  });
}

function runInBackground(promise: Promise<unknown>) {
  const handledPromise = promise.catch((error) => {
    console.error("Background price suggestion refinement failed:", error);
  });
  const runtime = (globalThis as unknown as {
    EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void };
  }).EdgeRuntime;

  if (runtime?.waitUntil) {
    runtime.waitUntil(handledPromise);
  }
}

function parsePrice(result: ShoppingResult) {
  if (typeof result.extracted_price === "number" && result.extracted_price > 0) {
    return result.extracted_price;
  }

  return normalisePrice(result.price);
}

function looksLikeRand(result: ShoppingResult) {
  const rawPrice = normaliseText(result.price).toLowerCase();
  return rawPrice.includes("r") || rawPrice.includes("zar") || rawPrice.includes("rand");
}

function percentile(sortedValues: number[], ratio: number) {
  if (sortedValues.length === 0) return 0;
  const index = (sortedValues.length - 1) * ratio;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) return sortedValues[lower];

  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (index - lower);
}

function median(values: number[]) {
  return percentile([...values].sort((a, b) => a - b), 0.5);
}

function calculateVariation(values: number[], baseline: number) {
  if (values.length === 0 || baseline <= 0) return 1;
  const min = Math.min(...values);
  const max = Math.max(...values);

  return (max - min) / baseline;
}

function removeOutliers(values: number[]) {
  if (values.length < 4) return values;

  const sortedValues = [...values].sort((a, b) => a - b);
  const q1 = percentile(sortedValues, 0.25);
  const q3 = percentile(sortedValues, 0.75);
  const iqr = q3 - q1;
  const lowerBound = q1 - iqr * 1.5;
  const upperBound = q3 + iqr * 1.5;

  return values.filter((value) => value >= lowerBound && value <= upperBound);
}

function roundToNearestFive(value: number) {
  return Math.round(value / 5) * 5;
}

function formatZar(value: number) {
  return `R ${value.toLocaleString("en-ZA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function withCacheMeta(response: Record<string, unknown>, hit: boolean, cacheKey: string) {
  return {
    ...response,
    cache: {
      hit,
      key: cacheKey,
    },
  };
}

function cacheRequestMatchesBase(
  request: unknown,
  {
    baseFingerprint,
    query,
    description,
    category,
    condition,
    location,
    imageUrl,
    listingPrice,
    baseSearchQuery,
  }: {
    baseFingerprint: string;
    query: string;
    description: string;
    category: string;
    condition: string;
    location: string;
    imageUrl: string;
    listingPrice: number | null;
    baseSearchQuery: string;
  },
) {
  if (!request || typeof request !== "object") return false;

  const cacheRequest = request as Record<string, unknown>;

  if (
    cacheRequest.fingerprint === baseFingerprint ||
    cacheRequest.baseFingerprint === baseFingerprint
  ) {
    return true;
  }

  return (
    normaliseText(cacheRequest.query) === query &&
    normaliseText(cacheRequest.description) === description &&
    normaliseText(cacheRequest.category) === category &&
    normaliseText(cacheRequest.condition) === condition &&
    normaliseText(cacheRequest.location) === location &&
    normaliseImageUrl(cacheRequest.imageUrl) === imageUrl &&
    normalisePrice(cacheRequest.listingPrice) === listingPrice &&
    normaliseText(cacheRequest.baseSearchQuery) === baseSearchQuery
  );
}

async function upsertCache(
  adminClient: ReturnType<typeof createClient>,
  {
    cacheKey,
    listingId,
    request,
    response,
  }: {
    cacheKey: string;
    listingId: string | null;
    request: Record<string, unknown>;
    response: Record<string, unknown>;
  },
) {
  const { error } = await adminClient
    .from("price_suggestion_cache")
    .upsert(
      {
        cache_key: cacheKey,
        listing_id: listingId,
        request,
        response,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "cache_key" },
    );

  if (error) {
    console.error("Failed to write price suggestion cache:", error.message);
  }
}

function getConfidence({
  query,
  description,
  category,
  modelSignals,
  brandSignals,
  sampleSize,
  variation,
  relevantSampleSize,
  meaningfulTokenCount,
  pricingBasis,
  rejectedSampleCount,
  sanityWarning,
}: {
  query: string;
  description: string;
  category: string;
  modelSignals: string[];
  brandSignals: string[];
  sampleSize: number;
  variation: number;
  relevantSampleSize: number;
  meaningfulTokenCount: number;
  pricingBasis: { level: string; label: string; usedFallback: boolean };
  rejectedSampleCount: number;
  sanityWarning: string;
}) {
  let score = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (modelSignals.length > 0) {
    score += 35;
    reasons.push(`Detected model-like detail: ${modelSignals.join(", ")}.`);
  } else {
    warnings.push("No model number or product code was detected.");
  }

  if (brandSignals.length > 0) {
    score += 20;
    reasons.push(`Detected brand context: ${brandSignals.join(", ")}.`);
  }

  if (hasSpecificText(`${query} ${description}`)) {
    score += 15;
    reasons.push("The listing text has enough descriptive terms to narrow the search.");
  } else {
    warnings.push("The listing text is broad, so the search may include different product types.");
  }

  if (meaningfulTokenCount >= 2 && relevantSampleSize >= 3) {
    score += 15;
    reasons.push("Shopping result titles match the listing details.");
  } else if (meaningfulTokenCount >= 2) {
    score -= 20;
    warnings.push("Shopping results did not closely match the listing details.");
  }

  if (category) {
    score += 10;
  }

  if (sampleSize >= 6) {
    score += 15;
    reasons.push("Enough comparable prices were found.");
  } else if (sampleSize >= 3) {
    score += 8;
    warnings.push("Only a small number of comparable prices were found.");
  } else {
    warnings.push("Too few comparable prices were found.");
  }

  if (variation <= 0.35) {
    score += 20;
    reasons.push("Comparable prices are tightly grouped.");
  } else if (variation <= 0.8) {
    score += 10;
    warnings.push("Comparable prices vary moderately.");
  } else {
    warnings.push("Comparable prices vary widely, which usually means the search is too broad.");
  }

  if (pricingBasis.usedFallback) {
    warnings.push(`Used ${pricingBasis.label} because exact listing matches were limited.`);
    score = Math.min(score, pricingBasis.level === "brand_category" ? 68 : 52);
  } else {
    reasons.push("Used the detailed listing search as the pricing basis.");
  }

  if (rejectedSampleCount > 0) {
    warnings.push("Ignored shopping results that looked like accessories or a different item type.");
  }

  if (sanityWarning) {
    warnings.push(sanityWarning);
  }

  const boundedScore = Math.max(0, Math.min(100, score));
  const level = boundedScore >= 75 ? "High" : boundedScore >= 45 ? "Medium" : "Low";

  return {
    level,
    score: boundedScore,
    reasons,
    warnings,
    needsMoreDetail: level === "Low",
  };
}

function buildPriceSuggestionResponse({
  query,
  description,
  category,
  condition,
  conditionFactor,
  location,
  imageSearch,
  modelSignals,
  brandSignals,
  meaningfulTokens,
  selectedAttempt,
  attemptedPricingBasis,
}: {
  query: string;
  description: string;
  category: string;
  condition: string;
  conditionFactor: number;
  location: string;
  imageSearch: Record<string, unknown>;
  modelSignals: string[];
  brandSignals: string[];
  meaningfulTokens: string[];
  selectedAttempt: PricingAttempt;
  attemptedPricingBasis: Array<Record<string, unknown>>;
}) {
  if (!selectedAttempt.pricing) {
    throw new Error("Cannot build a price suggestion without evaluated pricing.");
  }

  const { filteredPrices, relevantResults, usableResults, rejectedResults } = selectedAttempt.pricing;
  const retailMedian = roundToNearestFive(median(filteredPrices));
  const retailAverage = roundToNearestFive(
    filteredPrices.reduce((total, price) => total + price, 0) / filteredPrices.length,
  );
  const priceVariation = calculateVariation(filteredPrices, retailMedian);
  const suggestedPrice = roundToNearestFive(retailMedian * conditionFactor);
  const confidence = getConfidence({
    query,
    description,
    category,
    modelSignals,
    brandSignals,
    sampleSize: filteredPrices.length,
    variation: priceVariation,
    relevantSampleSize: relevantResults.length,
    meaningfulTokenCount: meaningfulTokens.length,
    pricingBasis: selectedAttempt.basis,
    rejectedSampleCount: rejectedResults.length,
    sanityWarning: selectedAttempt.sanity.warning,
  });
  const suggestedRange = {
    min: roundToNearestFive(suggestedPrice * 0.9),
    max: roundToNearestFive(suggestedPrice * 1.1),
  };

  return {
    query,
    searchQuery: selectedAttempt.basis.query,
    condition,
    conditionFactor,
    location,
    market: "South Africa",
    currency: "ZAR",
    confidence,
    pricingBasis: {
      level: selectedAttempt.basis.level,
      label: selectedAttempt.basis.label,
      searchQuery: selectedAttempt.basis.query,
      usedFallback: selectedAttempt.basis.usedFallback,
      attempted: attemptedPricingBasis,
      rejectedSampleSize: rejectedResults.length,
      sanityStatus: selectedAttempt.sanity.status,
    },
    imageSearch,
    detectedSignals: {
      models: modelSignals,
      brands: brandSignals,
    },
    suggestedPrice,
    suggestedPriceFormatted: formatZar(suggestedPrice),
    suggestedRange: {
      ...suggestedRange,
      minFormatted: formatZar(suggestedRange.min),
      maxFormatted: formatZar(suggestedRange.max),
    },
    retailPrice: {
      median: retailMedian,
      medianFormatted: formatZar(retailMedian),
      average: retailAverage,
      averageFormatted: formatZar(retailAverage),
      min: roundToNearestFive(Math.min(...filteredPrices)),
      max: roundToNearestFive(Math.max(...filteredPrices)),
      sampleSize: filteredPrices.length,
      variation: Number(priceVariation.toFixed(2)),
    },
    sources: usableResults.slice(0, 8).map((result) => ({
      title: result.title || "",
      source: result.source || "",
      price: result.price || "",
      extractedPrice: result.extractedPrice,
      link: result.link || result.product_link || "",
      thumbnail: result.thumbnail || "",
    })),
    generatedAt: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const serpApiKey = Deno.env.get("SERPAPI_API_KEY");
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey || !serpApiKey) {
    return jsonResponse({ error: "Missing required backend environment variables." }, 500);
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  let body: PriceSuggestionRequest;

  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }

  const listingId = body.listingId === undefined || body.listingId === null
    ? ""
    : String(body.listingId).trim();
  const query = normaliseText(body.query);
  const description = normaliseText(body.description);
  const category = normaliseText(body.category);
  const condition = normaliseText(body.condition) || DEFAULT_CONDITION;
  const location = normaliseText(body.location) || DEFAULT_LOCATION;
  const listingPrice = normalisePrice(body.listingPrice) ?? normalisePrice(body.price);
  const imageUrl =
    normaliseImageUrl(body.imageUrl) ||
    normaliseImageUrl(Array.isArray(body.imageUrls) ? body.imageUrls.find(Boolean) : "");

  if (query.length < 2) {
    return jsonResponse({ error: "Provide an item name or search query." }, 400);
  }

  const conditionFactor = conditionFactors[condition] ?? conditionFactors[DEFAULT_CONDITION];
  const baseSearchQuery = buildSearchQuery(query, category, description);
  const baseMeaningfulTokens = getMeaningfulTokens(`${query} ${description}`);
  const listingText = `${query} ${category} ${description}`;
  const modelSignals = findModelSignals(listingText);
  const brandSignals = findBrandSignals(listingText);
  const baseFingerprint = await buildRequestFingerprint({
    searchQuery: baseSearchQuery,
    condition,
    location,
    imageUrl,
    listingPrice,
  });
  const baseSearchCacheKey = `search:${CACHE_VERSION}:${baseFingerprint}`;
  const listingCacheKey = listingId ? `listing:${CACHE_VERSION}:${listingId}` : baseSearchCacheKey;
  const baseCacheRequest = {
    version: CACHE_VERSION,
    fingerprint: baseFingerprint,
    baseFingerprint,
    listingId: listingId || null,
    query,
    description,
    category,
    condition,
    location,
    listingPrice,
    imageUrl: imageUrl || null,
    searchQuery: baseSearchQuery,
    baseSearchQuery,
    imageSearch: { used: false, terms: [] as string[], sourceTitles: [] as string[] },
  };

  try {
    const { data: cachedSuggestion, error: cacheReadError } = await adminClient
      .from("price_suggestion_cache")
      .select("request, response")
      .eq("cache_key", listingCacheKey)
      .maybeSingle();

    if (cacheReadError) {
      console.error("Failed to read price suggestion cache:", cacheReadError.message);
    }

    if (
      cachedSuggestion?.response &&
      (!listingId ||
        cacheRequestMatchesBase(cachedSuggestion.request, {
          baseFingerprint,
          query,
          description,
          category,
          condition,
          location,
          imageUrl,
          listingPrice,
          baseSearchQuery,
        }))
    ) {
      return jsonResponse(withCacheMeta(cachedSuggestion.response, true, listingCacheKey));
    }

    if (listingId) {
      const { data: cachedBaseSearchSuggestion, error: baseSearchCacheReadError } = await adminClient
        .from("price_suggestion_cache")
        .select("request, response")
        .eq("cache_key", baseSearchCacheKey)
        .maybeSingle();

      if (baseSearchCacheReadError) {
        console.error(
          "Failed to read base search price suggestion cache:",
          baseSearchCacheReadError.message,
        );
      }

      if (
        cachedBaseSearchSuggestion?.response &&
        cacheRequestMatchesBase(cachedBaseSearchSuggestion.request, {
          baseFingerprint,
          query,
          description,
          category,
          condition,
          location,
          imageUrl,
          listingPrice,
          baseSearchQuery,
        })
      ) {
        await upsertCache(adminClient, {
          cacheKey: listingCacheKey,
          listingId,
          request: baseCacheRequest,
          response: cachedBaseSearchSuggestion.response,
        });

        return jsonResponse(withCacheMeta(cachedBaseSearchSuggestion.response, true, listingCacheKey));
      }
    }

    const responseStartedAt = Date.now();
    const meaningfulTokens = getMeaningfulTokens(`${query} ${description}`);
    const fallbackImageSearch = {
      used: false,
      terms: [] as string[],
      sourceTitles: [] as string[],
    };
    const shouldUseImageSearch =
      imageUrl &&
      (modelSignals.length === 0 || brandSignals.length === 0 || baseMeaningfulTokens.length < 3);
    const imageSearchPromise = shouldUseImageSearch
      ? getImageSearchContext({
          serpApiKey,
          imageUrl,
          searchQuery: baseSearchQuery,
          originalTokens: baseMeaningfulTokens,
        })
      : Promise.resolve(fallbackImageSearch);
    const baseSearchCandidates = buildSearchCandidates({
      searchQuery: baseSearchQuery,
      query,
      category,
      brandSignals,
      modelSignals,
    });
    const baseSearchTasks = startCandidateEvaluations({
      candidates: baseSearchCandidates,
      serpApiKey,
      location,
      category,
      listingText,
      listingPrice,
      conditionFactor,
    });
    const lensSearchPackPromise = imageSearchPromise.then((imageSearch) => {
      const lensSearchQuery = dedupeWords(
        [baseSearchQuery, ...imageSearch.terms].filter(Boolean).join(" "),
      );
      const existingQueries = new Set(baseSearchCandidates.map((candidate) => candidate.query.toLowerCase()));
      const lensSearchCandidates = lensSearchQuery.toLowerCase() === baseSearchQuery.toLowerCase()
        ? []
        : buildSearchCandidates({
            searchQuery: lensSearchQuery,
            query,
            category,
            brandSignals,
            modelSignals,
          }).filter((candidate) => !existingQueries.has(candidate.query.toLowerCase()));
      const lensSearchTasks = startCandidateEvaluations({
        candidates: lensSearchCandidates,
        serpApiKey,
        location,
        category,
        listingText,
        listingPrice,
        conditionFactor,
      });

      return {
        imageSearch,
        searchQuery: lensSearchQuery,
        tasks: lensSearchTasks.map((task, index) => ({
          ...task,
          index: baseSearchTasks.length + index,
        })),
      };
    });
    const timedLensSearchPack = await Promise.race([
      lensSearchPackPromise,
      delay(Math.min(IMAGE_SEARCH_TIMEOUT_MS, SHOPPING_SEARCH_BUDGET_MS)),
    ]);
    const foregroundImageSearch = timedLensSearchPack === "timeout"
      ? fallbackImageSearch
      : timedLensSearchPack.imageSearch;
    const foregroundSearchTasks = timedLensSearchPack === "timeout"
      ? baseSearchTasks
      : [...baseSearchTasks, ...timedLensSearchPack.tasks];
    const elapsedMs = Date.now() - responseStartedAt;
    const foregroundAttempts = await collectCompletedAttempts(
      foregroundSearchTasks,
      Math.max(RESPONSE_GRACE_MS, SHOPPING_SEARCH_BUDGET_MS - elapsedMs),
    );
    const selectedAttempt = selectBestPricingAttempt(foregroundAttempts);
    const attemptedPricingBasis = foregroundAttempts.map(attemptSummary);

    if (!selectedAttempt) {
      return jsonResponse(
        {
          error: "Price check inconclusive. No reliable shopping matches were found for this listing.",
          query,
          searchQuery: baseSearchQuery,
          location,
          pricingBasis: {
            level: "failed_match",
            label: "no reliable pricing basis",
            attempted: attemptedPricingBasis,
          },
        },
        404,
      );
    }

    const searchQuery = selectedAttempt.basis.query;
    const requestFingerprint = await buildRequestFingerprint({
      searchQuery,
      condition,
      location,
      imageUrl,
      listingPrice,
    });
    const searchCacheKey = `search:${CACHE_VERSION}:${requestFingerprint}`;
    const cacheKey = listingId ? listingCacheKey : searchCacheKey;
    const cacheRequest = {
      version: CACHE_VERSION,
      fingerprint: requestFingerprint,
      baseFingerprint,
      listingId: listingId || null,
      query,
      description,
      category,
      condition,
      location,
      listingPrice,
      imageUrl: imageUrl || null,
      searchQuery,
      baseSearchQuery,
      imageSearch: foregroundImageSearch,
    };
    const responseBody = buildPriceSuggestionResponse({
      query,
      description,
      category,
      condition,
      conditionFactor,
      location,
      imageSearch: foregroundImageSearch,
      modelSignals,
      brandSignals,
      meaningfulTokens,
      selectedAttempt,
      attemptedPricingBasis,
    });

    await upsertCache(adminClient, {
      cacheKey,
      listingId: listingId || null,
      request: cacheRequest,
      response: responseBody,
    });

    if (searchCacheKey !== cacheKey) {
      await upsertCache(adminClient, {
        cacheKey: searchCacheKey,
        listingId: null,
        request: cacheRequest,
        response: responseBody,
      });
    }

    if (baseSearchCacheKey !== cacheKey && baseSearchCacheKey !== searchCacheKey) {
      await upsertCache(adminClient, {
        cacheKey: baseSearchCacheKey,
        listingId: null,
        request: {
          ...cacheRequest,
          fingerprint: baseFingerprint,
          searchQuery: baseSearchQuery,
        },
        response: responseBody,
      });
    }

    runInBackground((async () => {
      const lensSearchPack = await lensSearchPackPromise;
      const allTasks = [
        ...baseSearchTasks,
        ...lensSearchPack.tasks,
      ];
      const allAttempts = await settleAllAttempts(allTasks);
      const refinedAttempt = selectBestPricingAttempt(allAttempts);

      if (!refinedAttempt) return;

      const refinedSearchQuery = refinedAttempt.basis.query;
      const refinedFingerprint = await buildRequestFingerprint({
        searchQuery: refinedSearchQuery,
        condition,
        location,
        imageUrl,
        listingPrice,
      });
      const refinedSearchCacheKey = `search:${CACHE_VERSION}:${refinedFingerprint}`;
      const refinedCacheKey = listingId ? listingCacheKey : refinedSearchCacheKey;
      const refinedCacheRequest = {
        ...cacheRequest,
        fingerprint: refinedFingerprint,
        searchQuery: refinedSearchQuery,
        imageSearch: lensSearchPack.imageSearch,
      };
      const refinedResponseBody = buildPriceSuggestionResponse({
        query,
        description,
        category,
        condition,
        conditionFactor,
        location,
        imageSearch: lensSearchPack.imageSearch,
        modelSignals,
        brandSignals,
        meaningfulTokens,
        selectedAttempt: refinedAttempt,
        attemptedPricingBasis: allAttempts.map(attemptSummary),
      });

      await upsertCache(adminClient, {
        cacheKey: refinedCacheKey,
        listingId: listingId || null,
        request: refinedCacheRequest,
        response: refinedResponseBody,
      });

      if (refinedSearchCacheKey !== refinedCacheKey) {
        await upsertCache(adminClient, {
          cacheKey: refinedSearchCacheKey,
          listingId: null,
          request: refinedCacheRequest,
          response: refinedResponseBody,
        });
      }

      if (baseSearchCacheKey !== refinedCacheKey && baseSearchCacheKey !== refinedSearchCacheKey) {
        await upsertCache(adminClient, {
          cacheKey: baseSearchCacheKey,
          listingId: null,
          request: {
            ...refinedCacheRequest,
            fingerprint: baseFingerprint,
            searchQuery: baseSearchQuery,
          },
          response: refinedResponseBody,
        });
      }
    })());

    return jsonResponse(withCacheMeta(responseBody, false, cacheKey));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate price suggestion.";
    return jsonResponse({ error: message }, 500);
  }
});

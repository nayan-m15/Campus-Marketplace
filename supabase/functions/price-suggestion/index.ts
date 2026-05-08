import { createClient } from "npm:@supabase/supabase-js@2";

const SERPAPI_URL = "https://serpapi.com/search.json";
const DEFAULT_LOCATION = "Johannesburg, South Africa";
const DEFAULT_CONDITION = "Good";

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
  query?: string;
  description?: string;
  category?: string;
  condition?: string;
  location?: string;
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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normaliseText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

function parsePrice(result: ShoppingResult) {
  if (typeof result.extracted_price === "number" && result.extracted_price > 0) {
    return result.extracted_price;
  }

  const rawPrice = normaliseText(result.price);
  if (!rawPrice) return null;

  const compact = rawPrice.replace(/\s/g, "");
  const numericText = compact
    .replace(/[^0-9.,]/g, "")
    .replace(/,(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const price = Number(numericText);

  return Number.isFinite(price) && price > 0 ? price : null;
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

function getConfidence({
  query,
  description,
  category,
  modelSignals,
  brandSignals,
  sampleSize,
  variation,
}: {
  query: string;
  description: string;
  category: string;
  modelSignals: string[];
  brandSignals: string[];
  sampleSize: number;
  variation: number;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serpApiKey = Deno.env.get("SERPAPI_API_KEY");
  const authHeader = req.headers.get("Authorization");

  if (!supabaseUrl || !supabaseAnonKey || !serpApiKey) {
    return jsonResponse({ error: "Missing required backend environment variables." }, 500);
  }

  if (!authHeader) {
    return jsonResponse({ error: "Missing authorization header." }, 401);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return jsonResponse({ error: authError?.message || "User not authenticated." }, 401);
  }

  let body: PriceSuggestionRequest;

  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }

  const query = normaliseText(body.query);
  const description = normaliseText(body.description);
  const category = normaliseText(body.category);
  const condition = normaliseText(body.condition) || DEFAULT_CONDITION;
  const location = normaliseText(body.location) || DEFAULT_LOCATION;

  if (query.length < 2) {
    return jsonResponse({ error: "Provide an item name or search query." }, 400);
  }

  const conditionFactor = conditionFactors[condition] ?? conditionFactors[DEFAULT_CONDITION];
  const searchQuery = buildSearchQuery(query, category, description);
  const listingText = `${query} ${category} ${description}`;
  const modelSignals = findModelSignals(listingText);
  const brandSignals = findBrandSignals(listingText);
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

  try {
    const serpResponse = await fetch(`${SERPAPI_URL}?${params.toString()}`);
    const serpData = await serpResponse.json();

    if (!serpResponse.ok || serpData.error) {
      return jsonResponse(
        { error: serpData.error || "Failed to fetch shopping prices from SerpApi." },
        serpResponse.ok ? 502 : serpResponse.status,
      );
    }

    const shoppingResults = Array.isArray(serpData.shopping_results)
      ? serpData.shopping_results as ShoppingResult[]
      : [];
    const pricedResults = shoppingResults
      .map((result) => ({ ...result, extractedPrice: parsePrice(result) }))
      .filter((result) => result.extractedPrice !== null);

    const randResults = pricedResults.filter(looksLikeRand);
    const usableResults = randResults.length > 0 ? randResults : pricedResults;
    const prices = usableResults.map((result) => result.extractedPrice as number);
    const filteredPrices = removeOutliers(prices);

    if (filteredPrices.length === 0) {
      return jsonResponse(
        {
          error: "No usable South African shopping prices were found for this item.",
          query,
          searchQuery,
          location,
        },
        404,
      );
    }

    const retailMedian = roundToNearestFive(median(filteredPrices));
    const retailAverage = roundToNearestFive(
      filteredPrices.reduce((total, price) => total + price, 0) / filteredPrices.length,
    );
    const priceVariation = calculateVariation(filteredPrices, retailMedian);
    const confidence = getConfidence({
      query,
      description,
      category,
      modelSignals,
      brandSignals,
      sampleSize: filteredPrices.length,
      variation: priceVariation,
    });
    const suggestedPrice = roundToNearestFive(retailMedian * conditionFactor);
    const suggestedRange = {
      min: roundToNearestFive(suggestedPrice * 0.9),
      max: roundToNearestFive(suggestedPrice * 1.1),
    };

    return jsonResponse({
      query,
      searchQuery,
      condition,
      conditionFactor,
      location,
      market: "South Africa",
      currency: "ZAR",
      confidence,
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
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate price suggestion.";
    return jsonResponse({ error: message }, 500);
  }
});

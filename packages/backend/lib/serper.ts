export type SearchInput = {
  q: string;
  num: number;
};

export type SearchParameters = {
  q: string;
  type: string;
  engine: string;
};

export type KnowledgeGraph = {
  title: string;
  type: string;
  rating?: number;
  ratingCount?: number;
  imageUrl?: string;
  attributes?: Record<string, string>;
};

export type Sitelink = {
  title: string;
  link: string;
};

export type OrganicResult = {
  title: string;
  link: string;
  snippet: string;
  sitelinks?: Sitelink[];
  position: number;
  date?: string;
};

export type PeopleAlsoAskResult = {
  question: string;
  snippet: string;
  title: string;
  link: string;
};

export type RelatedSearch = {
  query: string;
};

export type SearchResult = {
  searchParameters: SearchParameters;
  knowledgeGraph?: KnowledgeGraph;
  organic: OrganicResult[];
  peopleAlsoAsk?: PeopleAlsoAskResult[];
  relatedSearches?: RelatedSearch[];
  credits: number;
};

async function fetchFromSerper(
  url: string,
  options: Omit<RequestInit, "headers">
): Promise<SearchResult> {
  const SERPER_API_KEY = process.env.SERPER_API_KEY;

  const response = await fetch(`https://google.serper.dev${url}`, {
    ...options,
    headers: {
      "X-API-KEY": SERPER_API_KEY!,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Serper API error: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  return json;
}

export async function searchSerper(body: SearchInput) {
  const results = await fetchFromSerper("/search", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return results;
}

export async function performWebSearch(query: string): Promise<
  Array<{
    title: string;
    url: string;
    snippet: string;
  }>
> {
  const searchResults = await searchSerper({
    q: query,
    num: 3,
  });

  const results =
    searchResults.organic?.map((result) => ({
      title: result.title || "No title",
      url: result.link || "",
      snippet: result.snippet || "No snippet available",
    })) || [];

  return results;
}

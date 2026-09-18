// survey-store registry helpers — the shareability layer.
//
// Shared /survey and /results links are only self-contained if a browser
// can recover a survey's off-chain metadata (title/questions/options) from
// the public registry. These tests pin that behavior: parse-robustness,
// never-clobber semantics, and the restore no-op when metadata already
// exists locally.
//
// localStorage is not available under the node test environment, so a
// stub is installed in its place — the store module only needs the four
// methods it actually uses (getItem/setItem/removeItem).

const store = new Map<string, string>();

// @ts-expect-error — minimal localStorage stub for the node test env
global.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

// fetch stub: serves /survey-registry.json from an in-memory map.
const registryPayload = JSON.stringify({
  network: "preprod",
  surveys: [
    {
      id: "9b6e0eed1f8a8f2a79ed2db9fe35570e1ad30ab8f8c358c44bc4b7e06ed7eeff",
      title: "App Feedback",
      questionCount: 1,
      questions: [
        {
          index: 0,
          text: "Rate this app on a scale of 1 to 5",
          options: ["1", "2", "3", "4", "5"],
        },
      ],
      createdAt: 1789663269472,
      status: "live",
    },
  ],
});

const globalRef = globalThis as unknown as {
  fetch: (
    input: string,
  ) => Promise<{ ok: boolean; status?: number; json: () => Promise<unknown> }>;
};

globalRef.fetch = async (input: string) => {
  if (input === "/survey-registry.json") {
    return {
      ok: true,
      status: 200,
      json: async () => JSON.parse(registryPayload),
    };
  }
  return { ok: false, status: 404, json: async () => ({}) };
};

import {
  applyRegistryEntry,
  fetchSurveyRegistry,
  getSurvey,
  restoreSurveyFromRegistry,
  saveSurvey,
} from "../src/lib/survey-store";

const APP_FEEDBACK =
  "9b6e0eed1f8a8f2a79ed2db9fe35570e1ad30ab8f8c358c44bc4b7e06ed7eeff";
const UNKNOWN =
  "726d6ed127a07b6c26d1543d948c93e9710784e82a6778d159f3107fdd694de2";

beforeEach(() => {
  store.clear();
});

describe("fetchSurveyRegistry", () => {
  test("parses the registry file", async () => {
    const reg = await fetchSurveyRegistry();
    expect(reg?.network).toBe("preprod");
    expect(reg?.surveys).toHaveLength(1);
    expect(reg?.surveys[0].title).toBe("App Feedback");
  });

  test("returns null on a failed fetch instead of throwing", async () => {
    const before = globalRef.fetch;
    globalRef.fetch = async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    expect(await fetchSurveyRegistry()).toBeNull();
    globalRef.fetch = before;
  });

  test("returns null on a malformed body instead of throwing", async () => {
    const before = globalRef.fetch;
    globalRef.fetch = async () => {
      throw new Error("offline");
    };
    expect(await fetchSurveyRegistry()).toBeNull();
    globalRef.fetch = before;
  });
});

describe("applyRegistryEntry", () => {
  test("stores a known entry with its metadata", () => {
    const reg = {
      network: "preprod",
      surveys: [
        {
          id: APP_FEEDBACK,
          title: "App Feedback",
          questions: [{ index: 0, text: "Rate this app", options: ["1", "2"] }],
        },
      ],
    };
    const stored = applyRegistryEntry(reg, APP_FEEDBACK);
    expect(stored?.title).toBe("App Feedback");
    expect(stored?.questionCount).toBe(1);
    expect(getSurvey(APP_FEEDBACK)?.title).toBe("App Feedback");
  });

  test("returns null and stores nothing for an unknown id", () => {
    const reg = { network: "preprod", surveys: [] };
    expect(applyRegistryEntry(reg, UNKNOWN)).toBeNull();
    expect(getSurvey(UNKNOWN)).toBeUndefined();
  });

  test("never clobbers an existing local entry", () => {
    saveSurvey({
      id: APP_FEEDBACK,
      title: "Locally edited title",
      questionCount: 1,
      questions: [],
      createdAt: 1,
    });
    const reg = {
      network: "preprod",
      surveys: [{ id: APP_FEEDBACK, title: "Registry title" }],
    };
    expect(applyRegistryEntry(reg, APP_FEEDBACK)).toBeNull();
    expect(getSurvey(APP_FEEDBACK)?.title).toBe("Locally edited title");
  });

  test("fills defaults for incomplete entries", () => {
    const reg = { network: "preprod", surveys: [{ id: APP_FEEDBACK }] };
    const stored = applyRegistryEntry(reg, APP_FEEDBACK);
    expect(stored?.title).toBe(`Survey ${APP_FEEDBACK.slice(0, 10)}…`);
    expect(stored?.questionCount).toBe(0);
    expect(stored?.questions).toEqual([]);
  });
});

describe("restoreSurveyFromRegistry", () => {
  test("returns the local entry untouched when one exists", async () => {
    saveSurvey({
      id: APP_FEEDBACK,
      title: "Local copy",
      questionCount: 1,
      questions: [],
      createdAt: 1,
    });
    const res = await restoreSurveyFromRegistry(APP_FEEDBACK);
    expect(res?.title).toBe("Local copy");
  });

  test("restores from the registry when absent locally", async () => {
    const res = await restoreSurveyFromRegistry(APP_FEEDBACK);
    expect(res?.title).toBe("App Feedback");
    expect(getSurvey(APP_FEEDBACK)?.questions[0].text).toBe(
      "Rate this app on a scale of 1 to 5",
    );
  });

  test("returns null for a survey unknown to the registry", async () => {
    expect(await restoreSurveyFromRegistry(UNKNOWN)).toBeNull();
  });
});

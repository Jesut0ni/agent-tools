import { db, pool } from "../db/client.js";
import { developers } from "../db/schema/developers.js";
import { tools, toolVersions } from "../db/schema/tools.js";
import { generateApiKey } from "../lib/api-keys.js";
import { eq } from "drizzle-orm";

const DEMO_EMAIL = "demo@agent-tools.local";

interface SeedTool {
  slug: string;
  name: string;
  description: string;
  version: string;
  spec: unknown;
}

const TOOLS: SeedTool[] = [
  {
    slug: "demo-echo",
    name: "Echo",
    description: "Echoes whatever you send it. Great for testing tool wiring.",
    version: "0.1.0",
    spec: {
      endpoint: { method: "POST", url: "https://postman-echo.com/post" },
      input: {
        type: "object",
        properties: { message: { type: "string" } },
        required: ["message"],
      },
      output: { type: "object" },
      auth: { type: "none" },
      examples: [{ input: { message: "hello agents" } }],
    },
  },
  {
    slug: "httpbin-post",
    name: "HTTPBin Echo",
    description: "Echoes any JSON body you send. Useful for testing tool wiring before pointing at a real upstream.",
    version: "0.1.0",
    spec: {
      endpoint: { method: "POST", url: "https://httpbin.org/post" },
      input: {
        type: "object",
        properties: { payload: { type: "object" } },
      },
      output: { type: "object" },
      auth: { type: "none" },
      examples: [{ input: { payload: { hello: "world" } } }],
    },
  },
  {
    slug: "public-ip",
    name: "Public IP",
    description: "Returns the public IP of the caller as seen from the registry.",
    version: "0.1.0",
    spec: {
      endpoint: { method: "GET", url: "https://api.ipify.org/?format=json" },
      input: { type: "object", properties: {} },
      output: { type: "object", properties: { ip: { type: "string" } } },
      auth: { type: "none" },
      examples: [{ input: {} }],
    },
  },
  {
    slug: "random-fact",
    name: "Random Useless Fact",
    description: "Returns a random English useless fact. Good for testing agent reasoning over noisy data.",
    version: "0.1.0",
    spec: {
      endpoint: { method: "GET", url: "https://uselessfacts.jsph.pl/api/v2/facts/random?language=en" },
      input: { type: "object", properties: {} },
      output: { type: "object", properties: { text: { type: "string" }, source: { type: "string" } } },
      auth: { type: "none" },
      examples: [{ input: {} }],
    },
  },
  {
    slug: "weather-now",
    name: "Current Weather",
    description: "Returns current temperature and wind for a latitude/longitude pair. Powered by open-meteo, no API key.",
    version: "0.1.0",
    spec: {
      endpoint: { method: "GET", url: "https://api.open-meteo.com/v1/forecast" },
      input: {
        type: "object",
        properties: {
          latitude: { type: "number" },
          longitude: { type: "number" },
          current: { type: "string" },
        },
        required: ["latitude", "longitude"],
      },
      output: { type: "object" },
      auth: { type: "none" },
      examples: [
        {
          input: {
            latitude: 52.52,
            longitude: 13.41,
            current: "temperature_2m,wind_speed_10m",
          },
        },
      ],
    },
  },
];

async function main() {
  console.log("→ Seeding agent-tools...");

  let demoDev = await db.query.developers.findFirst({ where: eq(developers.email, DEMO_EMAIL) });
  let printedKey: string | null = null;

  if (!demoDev) {
    const { full, hash, preview } = generateApiKey();
    [demoDev] = await db
      .insert(developers)
      .values({ email: DEMO_EMAIL, apiKeyHash: hash, apiKeyPreview: preview })
      .returning();
    printedKey = full;
    console.log(`  + developer ${DEMO_EMAIL}`);
  } else {
    console.log(`  ✓ developer ${DEMO_EMAIL} already exists`);
  }

  for (const t of TOOLS) {
    const existing = await db.query.tools.findFirst({ where: eq(tools.slug, t.slug) });
    if (existing) {
      console.log(`  ✓ tool ${t.slug} already exists`);
      continue;
    }
    const now = new Date();
    const [tool] = await db
      .insert(tools)
      .values({
        slug: t.slug,
        name: t.name,
        description: t.description,
        ownerId: demoDev.id,
        visibility: "public",
        latestVersion: t.version,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    await db.insert(toolVersions).values({
      toolId: tool.id,
      version: t.version,
      spec: t.spec,
      createdAt: now,
    });
    console.log(`  + tool ${t.slug}`);
  }

  if (printedKey) {
    console.log("\n=========================================");
    console.log("  demo developer API key (save it):");
    console.log(`    ${printedKey}`);
    console.log("=========================================\n");
  } else {
    console.log("\n(demo developer already existed; its API key is unchanged)\n");
  }

  pool.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import type { MetadataRoute } from "next";

const BASE = "https://blottman.ca";
const ROUTES = [
  "",
  "/speeding",
  "/careless-driving",
  "/stunt-driving",
  "/disobey-sign",
  "/no-insurance",
  "/driving-under-suspension",
  "/no-licence",
  "/cell-phone",
  "/fail-to-stop",
  "/privacy",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((path) => ({
    url: `${BASE}${path}`,
    changeFrequency: "monthly",
    priority: path === "" ? 1 : path === "/privacy" ? 0.3 : 0.8,
  }));
}

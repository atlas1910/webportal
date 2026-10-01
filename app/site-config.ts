const defaultSiteUrl = "https://atlas1910.vercel.app";
const configuredSiteUrl = process.env.SITE_URL ?? defaultSiteUrl;
const parsedSiteUrl = new URL(configuredSiteUrl);

if (
  !["http:", "https:"].includes(parsedSiteUrl.protocol)
  || parsedSiteUrl.username
  || parsedSiteUrl.password
  || parsedSiteUrl.pathname !== "/"
  || parsedSiteUrl.search
  || parsedSiteUrl.hash
) {
  throw new Error(
    "SITE_URL must be an HTTP(S) origin without credentials, path, query, or hash."
  );
}

export const siteUrl = parsedSiteUrl.origin;

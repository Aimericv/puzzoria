export function legalDetails(env: Partial<NodeJS.ProcessEnv> = process.env) {
  return {
    publisher: env.LEGAL_PUBLISHER_NAME?.trim() ?? "",
    address: env.LEGAL_PUBLISHER_ADDRESS?.trim() ?? "",
    country: env.LEGAL_PUBLISHER_COUNTRY?.trim() ?? "",
    email: env.LEGAL_CONTACT_EMAIL?.trim() ?? "",
    host: env.LEGAL_HOST_NAME?.trim() ?? "",
    hostAddress: env.LEGAL_HOST_ADDRESS?.trim() ?? "",
    storageRegion: env.LEGAL_STORAGE_REGION?.trim() ?? "",
  };
}
export function missingLegalDetails(env: Partial<NodeJS.ProcessEnv> = process.env) {
  const missing = Object.entries(legalDetails(env)).filter(([, value]) => !value).map(([key]) => key);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(legalDetails(env).email) && !missing.includes("email")) missing.push("email");
  return missing;
}

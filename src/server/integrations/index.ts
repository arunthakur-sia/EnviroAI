// Integration stubs: typed touchpoints that currently return "not configured".
// Each will be replaced by a real connector without touching auth or routes.

export type IntegrationStatus = {
  code: string;
  name: string;
  status: "not_configured";
  description: string;
};

export const sharepoint = {
  status(): IntegrationStatus {
    return {
      code: "sharepoint",
      name: "SharePoint",
      status: "not_configured",
      description: "Will sync document libraries into Institutional Memory with metadata mapping.",
    };
  },
  // TODO: syncLibrary(siteUrl: string, libraryName: string): pull documents + metadata
  // TODO: pushDocument(documentId: string): publish an Institutional Memory document back to SharePoint
};

export const email = {
  status(): IntegrationStatus {
    return {
      code: "email",
      name: "Email",
      status: "not_configured",
      description: "Will send digests, routing notifications, and capture knowledge from a shared inbox.",
    };
  },
  // TODO: sendDigest(userId: string): weekly personal digest
  // TODO: ingestInbox(): turn flagged emails into draft Institutional Memory documents
};

export const gastat = {
  status(): IntegrationStatus {
    return {
      code: "gastat",
      name: "GASTAT Statistics Portal",
      status: "not_configured",
      description: "Will stream the 119 central indicators directly into the Statistics Hub.",
    };
  },
  // TODO: syncIndicators(): map the GASTAT statistics portal series onto indicator codes
};

export const opendata = {
  status(): IntegrationStatus {
    return {
      code: "opendata",
      name: "Open Data Portal",
      status: "not_configured",
      description: "Will publish approved indicators to the Saudi open data portal and track dataset usage.",
    };
  },
  // TODO: publishDataset(indicatorId: string)
};

export function allIntegrations(): IntegrationStatus[] {
  return [sharepoint.status(), email.status(), gastat.status(), opendata.status()];
}

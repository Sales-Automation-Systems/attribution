import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "Attribution Portal",
  version: packageJson.version,
  copyright: `© ${currentYear}, Sales Automation Systems.`,
  meta: {
    title: "Attribution Portal - Revenue Share Tracking",
    description:
      "Track and reconcile revenue share for cold email campaigns. Match attribution events, manage client reconciliation, and calculate revenue share.",
  },
};

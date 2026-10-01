import { createRoot } from "react-dom/client";
import TourFilter from "./tour-filter";
import { getProviderDirectory } from "@/lib/tours/provider-directory";
import { normalizeApiBase } from "@/lib/tours/api-client";
import "./styles.css";

const apiBaseUrl = import.meta.env.DEV ? "" : normalizeApiBase(import.meta.env.VITE_API_URL);
createRoot(document.getElementById("root")!).render(
  <TourFilter providers={getProviderDirectory()} apiBaseUrl={apiBaseUrl} />,
);

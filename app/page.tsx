import TourFilter from "./tour-filter";
import { getProviderDirectory } from "@/lib/tours/provider-directory.server";

export default function Home() {
  return <TourFilter providers={getProviderDirectory()}/>;
}

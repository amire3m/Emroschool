import {
  listCitiesByProvinceId,
  listProvinces,
  parseProvinceId,
} from "@/lib/iran-locations";
import { createLocationsHandler } from "@/lib/iran-location-route-handlers";

export const GET = createLocationsHandler({
  parseProvinceId,
  listProvinces,
  listCitiesByProvinceId,
});

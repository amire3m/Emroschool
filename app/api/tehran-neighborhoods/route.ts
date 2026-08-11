import { getTehranDistricts } from "@/lib/iran-locations";
import { createTehranNeighborhoodsHandler } from "@/lib/iran-location-route-handlers";

export const GET = createTehranNeighborhoodsHandler({ getTehranDistricts });

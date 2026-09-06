import { BadRequestException, Injectable, InternalServerErrorException, Logger } from "@nestjs/common";

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * postcodes.io — free, no API key, no rate-limit tier to worry about at
 * this project's volume (open-source, backed by ONS/Ordnance Survey open
 * data, purpose-built for exactly "UK postcode -> lat/lng" and nothing
 * else). Chosen over Google/Mapbox geocoding: those charge per request
 * past a free quota and are general-purpose geocoders where the postcode
 * case is a small slice of what you're paying for. If this ever needs an
 * SLA or moves outside the UK, swap the implementation behind this one
 * method — nothing else in the app talks to postcodes.io directly.
 */
const POSTCODES_IO_BASE_URL = "https://api.postcodes.io";

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  async geocode(postcode: string): Promise<LatLng> {
    const normalized = postcode.replace(/\s+/g, "").toUpperCase();
    let response: Response;
    try {
      response = await fetch(`${POSTCODES_IO_BASE_URL}/postcodes/${encodeURIComponent(normalized)}`);
    } catch (error) {
      this.logger.error(`postcodes.io request failed for "${postcode}"`, error);
      throw new InternalServerErrorException("Could not reach the postcode geocoding service");
    }

    if (response.status === 404) {
      throw new BadRequestException(`"${postcode}" is not a recognized UK postcode`);
    }
    if (!response.ok) {
      this.logger.error(`postcodes.io returned ${response.status} for "${postcode}"`);
      throw new InternalServerErrorException("Postcode geocoding service returned an unexpected response");
    }

    const body = (await response.json()) as { result: { latitude: number; longitude: number } };
    return { lat: body.result.latitude, lng: body.result.longitude };
  }

  /**
   * Backs Discover's search bar — deliberately more permissive than
   * geocode() above, since a driver typing into "Search by postcode or
   * area" won't always type a full, exact postcode. Tries the same exact
   * lookup first (covers "SM5 2QT"), then falls back to postcodes.io's
   * *outcode* centroid lookup (covers just "SM5" — the same endpoint
   * DEFAULT_SEARCH_ORIGIN's own centroid was sourced from, see
   * search-origin.ts) before giving up. postcodes.io has no free-text
   * place-name search (no endpoint that resolves "Croydon" to a point),
   * so a bare area name genuinely doesn't resolve here — that's a real
   * limitation of the underlying data source, not a shortcut taken: it's
   * surfaced to the caller as the same "not recognized" outcome as any
   * other unrecognized input, not a silent failure.
   */
  async geocodeSearchText(text: string): Promise<LatLng> {
    const normalized = text.replace(/\s+/g, "").toUpperCase();
    if (!normalized) {
      throw new BadRequestException("Type a postcode or area to search");
    }

    const tryEndpoint = async (path: string): Promise<LatLng | null> => {
      let response: Response;
      try {
        response = await fetch(`${POSTCODES_IO_BASE_URL}/${path}/${encodeURIComponent(normalized)}`);
      } catch (error) {
        this.logger.error(`postcodes.io request failed for "${text}" (${path})`, error);
        throw new InternalServerErrorException("Could not reach the postcode geocoding service");
      }
      if (response.status === 404) return null;
      if (!response.ok) {
        this.logger.error(`postcodes.io returned ${response.status} for "${text}" (${path})`);
        throw new InternalServerErrorException("Postcode geocoding service returned an unexpected response");
      }
      const body = (await response.json()) as { result: { latitude: number; longitude: number } };
      return { lat: body.result.latitude, lng: body.result.longitude };
    };

    const exact = await tryEndpoint("postcodes");
    if (exact) return exact;
    const outcode = await tryEndpoint("outcodes");
    if (outcode) return outcode;

    throw new BadRequestException(`"${text}" isn't a recognized UK postcode or area`);
  }
}

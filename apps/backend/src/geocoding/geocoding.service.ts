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
const POSTCODES_IO_BASE_URL = "https://api.postcodes.io/postcodes";

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  async geocode(postcode: string): Promise<LatLng> {
    const normalized = postcode.replace(/\s+/g, "").toUpperCase();
    let response: Response;
    try {
      response = await fetch(`${POSTCODES_IO_BASE_URL}/${encodeURIComponent(normalized)}`);
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
}

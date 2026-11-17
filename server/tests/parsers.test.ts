import AdmZip from 'adm-zip';
import { describe, expect, it } from 'vitest';
import { extractKml } from '../src/services/importService';
import { parseKml } from '../src/services/kmlService';
import { parseCtaResponse } from '../src/services/transit/ctaService';

const KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>My Places</name>
    <Folder>
      <name>Bars</name>
      <Folder>
        <name>Cocktails</name>
        <Placemark>
          <name>The Violet Hour</name>
          <description>Speakeasy</description>
          <Point><coordinates>-87.6776,41.9087,0</coordinates></Point>
        </Placemark>
      </Folder>
      <Placemark>
        <name>No point here</name>
        <LineString><coordinates>-87.6,41.9 -87.7,41.8</coordinates></LineString>
      </Placemark>
    </Folder>
    <Placemark>
      <name>Bad coords</name>
      <Point><coordinates>abc,def</coordinates></Point>
    </Placemark>
  </Document>
</kml>`;

describe('parseKml', () => {
    it('extracts points with their folder path and skips non-points / bad coordinates', () => {
        expect(parseKml(KML)).toEqual([
            {
                name: 'The Violet Hour',
                description: 'Speakeasy',
                latitude: 41.9087,
                longitude: -87.6776,
                folderPath: ['My Places', 'Bars', 'Cocktails'],
            },
        ]);
    });

    it('returns nothing for an empty document', () => {
        expect(parseKml('')).toEqual([]);
    });
});

describe('extractKml', () => {
    it('passes plain KML through', () => {
        expect(extractKml(Buffer.from(KML))).toBe(KML);
    });

    it('unzips KMZ archives', () => {
        const zip = new AdmZip();
        zip.addFile('doc.kml', Buffer.from(KML));
        expect(extractKml(zip.toBuffer())).toBe(KML);
    });

    it('rejects a KMZ with no KML inside', () => {
        const zip = new AdmZip();
        zip.addFile('readme.txt', Buffer.from('hi'));
        expect(() => extractKml(zip.toBuffer())).toThrow(/does not contain/);
    });
});

describe('parseCtaResponse', () => {
    it('normalizes single-object and array forms', () => {
        const trains = parseCtaResponse({
            ctatt: {
                errCd: '0',
                route: [
                    { '@name': 'red', train: { rn: '801', destNm: 'Howard', lat: '41.9', lon: '-87.6', heading: '90', prdt: '2026-11-17T12:00:00' } },
                    { '@name': 'blue' },
                ],
            },
        });
        expect(trains).toEqual([
            { id: '801', route: 'red', lat: 41.9, lon: -87.6, heading: 90, destination: 'Howard', lastUpdate: '2026-11-17T12:00:00' },
        ]);
    });

    it('surfaces API errors', () => {
        expect(() => parseCtaResponse({ ctatt: { errCd: '101', errNm: 'Invalid API key' } })).toThrow(/Invalid API key/);
    });
});

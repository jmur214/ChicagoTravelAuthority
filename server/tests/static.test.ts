import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { CtaService } from '../src/services/transit/ctaService';
import { GtfsService } from '../src/services/transit/gtfsService';

describe('serving the built web app', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cta-client-'));
    fs.mkdirSync(path.join(dir, 'assets'));
    fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><div id="root"></div>');
    fs.writeFileSync(path.join(dir, 'assets', 'app-abc123.js'), 'console.log(1)');
    fs.writeFileSync(path.join(dir, 'manifest.webmanifest'), '{}');

    const api = request(createApp({ cta: new CtaService(undefined), gtfs: new GtfsService('/nonexistent'), clientDir: dir }));

    afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

    it('serves the app shell at / and for client-side routes', async () => {
        for (const url of ['/', '/map', '/some/deep/link']) {
            const res = await api.get(url).expect(200);
            expect(res.text).toContain('id="root"');
            expect(res.headers['cache-control']).toBe('no-cache');
        }
    });

    it('serves static files, with long caching for hashed assets', async () => {
        const res = await api.get('/assets/app-abc123.js').expect(200);
        expect(res.headers['cache-control']).toContain('immutable');
        await api.get('/manifest.webmanifest').expect(200);
    });

    it('keeps API and health routes as JSON', async () => {
        expect((await api.get('/api/v1/trains').expect(200)).body.trains).toBeDefined();
        expect((await api.get('/api/v1/nope').expect(404)).body.error.code).toBe('NOT_FOUND');
        expect((await api.get('/health').expect(200)).body.status).toBe('ok');
        await api.post('/somewhere').expect(404);
    });
});

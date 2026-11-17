import { z } from 'zod';
import { OpenHoursSchema } from './openHours';

// ---------------------------------------------------------------------------
// Request schemas. The server validates every request body with these, and
// clients can reuse them for form validation so both sides agree on the rules.
// ---------------------------------------------------------------------------

/** Text field where "" means "clear it" (null) and undefined means "leave unchanged". */
const optionalText = (max: number) =>
    z.string().trim().max(max).nullish().transform(v => (v === '' ? null : v));

const HTTP_URL = /^https?:\/\/\S+$/i;
const optionalUrl = z
    .string()
    .trim()
    .max(2048)
    .refine(v => v === '' || HTTP_URL.test(v), 'Must be an http(s) URL')
    .nullish()
    .transform(v => (v === '' ? null : v));

const id = z.number().int().positive();

export const IdParamSchema = z.coerce.number().int().positive();

export const MARKER_SHAPES = ['circle', 'star', 'diamond', 'ring'] as const;
export const MarkerShapeSchema = z.enum(MARKER_SHAPES);
export type MarkerShape = z.infer<typeof MarkerShapeSchema>;

const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected a hex color like #FF0099');

// --- Locations -------------------------------------------------------------

export const LocationCreateSchema = z.object({
    name: z.string().trim().min(1, 'Name is required').max(200),
    description: optionalText(5000),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    address: optionalText(500),
    phoneNumber: optionalText(50),
    website: optionalUrl,
    menuUrl: optionalUrl,
    eventsInfo: optionalText(2000),
    avgCost: z.number().int().min(1).max(4).nullish(),
    avgStayMinutes: z.number().int().min(5).max(24 * 60).optional(),
    openHours: OpenHoursSchema.nullish(),
    isConfirmed: z.boolean().optional(),
    verifiedVibe: z.boolean().optional(),
    tagIds: z.array(id).optional(),
    categoryIds: z.array(id).optional(),
});
export type LocationCreateInput = z.input<typeof LocationCreateSchema>;
export type LocationCreate = z.output<typeof LocationCreateSchema>;

/** PATCH semantics: every field optional, omitted fields are left untouched. */
export const LocationUpdateSchema = LocationCreateSchema.partial();
export type LocationUpdateInput = z.input<typeof LocationUpdateSchema>;
export type LocationUpdate = z.output<typeof LocationUpdateSchema>;

export const LocationListQuerySchema = z.object({
    /** `all=true` includes unconfirmed locations (admin view). */
    all: z.enum(['true', 'false']).optional().transform(v => v === 'true'),
});

// --- Categories ------------------------------------------------------------

export const CategoryCreateSchema = z.object({
    name: z.string().trim().min(1).max(80),
    parentId: id.nullish(),
    color: HexColorSchema.optional(),
    shape: MarkerShapeSchema.optional(),
    isSingleSelect: z.boolean().optional(),
});
export type CategoryCreateInput = z.input<typeof CategoryCreateSchema>;

export const CategoryUpdateSchema = CategoryCreateSchema.partial();
export type CategoryUpdateInput = z.input<typeof CategoryUpdateSchema>;

// --- Tags ------------------------------------------------------------------

export const TagCreateSchema = z.object({
    name: z.string().trim().min(1).max(80),
    categoryIds: z.array(id).optional(),
});
export type TagCreateInput = z.input<typeof TagCreateSchema>;

export const TagUpdateSchema = z.object({
    name: z.string().trim().min(1).max(80),
});
export type TagUpdateInput = z.input<typeof TagUpdateSchema>;

export const TagCategoryLinkSchema = z.object({ categoryId: id });

// --- Planning --------------------------------------------------------------

export const TRANSPORT_MODES = ['walk', 'drive', 'transit'] as const;
export type TransportMode = (typeof TRANSPORT_MODES)[number];

export const PlanRequestSchema = z.object({
    startLocation: z
        .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
        .optional(),
    /** ISO-8601 with offset or Z. Defaults to now. */
    startTime: z.iso.datetime({ offset: true }).optional(),
    durationHours: z.number().min(0.5).max(24).default(4),
    categoryIds: z.array(id).default([]),
    /** Tag names to match (legacy "vibes"). */
    vibes: z.array(z.string()).default([]),
    neighborhoods: z.array(z.string()).optional(),
    transportMode: z.enum(TRANSPORT_MODES).default('drive'),
    budget: z.number().int().min(1).max(4).optional(),
    maxStops: z.number().int().min(1).max(10).default(5),
    /** 1 (chill) – 5 (chaos). Accepted but not yet used for scoring. */
    energyLevel: z.number().int().min(1).max(5).optional(),
});
export type PlanRequestInput = z.input<typeof PlanRequestSchema>;
export type PlanRequest = z.output<typeof PlanRequestSchema>;

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const REGISTRY_PATH = path.join(process.cwd(), 'src/config/medical-term-registry.json');

function readRegistry(): { medicalTerms: string[]; defaultScanDepth: number } {
    const raw = fs.readFileSync(REGISTRY_PATH, 'utf-8');
    return JSON.parse(raw);
}

function writeRegistry(data: { medicalTerms: string[]; defaultScanDepth: number }) {
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(data, null, 2) + '\n');
}

/** GET: Return the current registry */
export async function GET() {
    try {
        const registry = readRegistry();
        return NextResponse.json(registry);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/** POST: Add one or more medical terms to the registry */
export async function POST(request: Request) {
    try {
        const { medicalTerms } = await request.json();
        if (!medicalTerms || !Array.isArray(medicalTerms) || medicalTerms.length === 0) {
            return NextResponse.json({ error: 'Provide { medicalTerms: ["name1", "name2"] }' }, { status: 400 });
        }

        const registry = readRegistry();
        const existingSet = new Set(registry.medicalTerms.map(p => p.toLowerCase()));
        const added: string[] = [];

        for (const name of medicalTerms) {
            const trimmed = name.trim();
            if (trimmed && !existingSet.has(trimmed.toLowerCase())) {
                registry.medicalTerms.push(trimmed);
                existingSet.add(trimmed.toLowerCase());
                added.push(trimmed);
            }
        }

        if (added.length > 0) {
            writeRegistry(registry);
        }

        return NextResponse.json({
            added,
            total: registry.medicalTerms.length,
            message: added.length > 0
                ? `Added ${added.length} medical term(s) to registry.`
                : 'All medical terms already exist in registry.'
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/** DELETE: Remove a medical term from the registry */
export async function DELETE(request: Request) {
    try {
        const { medicalTerm } = await request.json();
        if (!medicalTerm) {
            return NextResponse.json({ error: 'Provide { medicalTerm: "name" }' }, { status: 400 });
        }

        const registry = readRegistry();
        const before = registry.medicalTerms.length;
        registry.medicalTerms = registry.medicalTerms.filter(
            p => p.toLowerCase() !== medicalTerm.toLowerCase()
        );

        if (registry.medicalTerms.length < before) {
            writeRegistry(registry);
            return NextResponse.json({ removed: medicalTerm, total: registry.medicalTerms.length });
        }

        return NextResponse.json({ error: 'Medical term not found in registry' }, { status: 404 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

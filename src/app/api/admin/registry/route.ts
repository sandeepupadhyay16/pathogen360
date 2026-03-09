import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const REGISTRY_PATH = path.join(process.cwd(), 'src/config/pathogen-registry.json');

function readRegistry(): { pathogens: string[]; defaultScanDepth: number } {
    const raw = fs.readFileSync(REGISTRY_PATH, 'utf-8');
    return JSON.parse(raw);
}

function writeRegistry(data: { pathogens: string[]; defaultScanDepth: number }) {
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

/** POST: Add one or more pathogens to the registry */
export async function POST(request: Request) {
    try {
        const { pathogens } = await request.json();
        if (!pathogens || !Array.isArray(pathogens) || pathogens.length === 0) {
            return NextResponse.json({ error: 'Provide { pathogens: ["name1", "name2"] }' }, { status: 400 });
        }

        const registry = readRegistry();
        const existingSet = new Set(registry.pathogens.map(p => p.toLowerCase()));
        const added: string[] = [];

        for (const name of pathogens) {
            const trimmed = name.trim();
            if (trimmed && !existingSet.has(trimmed.toLowerCase())) {
                registry.pathogens.push(trimmed);
                existingSet.add(trimmed.toLowerCase());
                added.push(trimmed);
            }
        }

        if (added.length > 0) {
            writeRegistry(registry);
        }

        return NextResponse.json({
            added,
            total: registry.pathogens.length,
            message: added.length > 0
                ? `Added ${added.length} pathogen(s) to registry.`
                : 'All pathogens already exist in registry.'
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/** DELETE: Remove a pathogen from the registry */
export async function DELETE(request: Request) {
    try {
        const { pathogen } = await request.json();
        if (!pathogen) {
            return NextResponse.json({ error: 'Provide { pathogen: "name" }' }, { status: 400 });
        }

        const registry = readRegistry();
        const before = registry.pathogens.length;
        registry.pathogens = registry.pathogens.filter(
            p => p.toLowerCase() !== pathogen.toLowerCase()
        );

        if (registry.pathogens.length < before) {
            writeRegistry(registry);
            return NextResponse.json({ removed: pathogen, total: registry.pathogens.length });
        }

        return NextResponse.json({ error: 'Pathogen not found in registry' }, { status: 404 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

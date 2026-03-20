import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
 
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json({ error: 'Term ID is required.' }, { status: 400 });
        }

        const term = await prisma.medicalTerm.findUnique({
            where: { id },
            include: {
                articles: {
                    orderBy: { publicationDate: 'desc' },
                },
                clinicalTrials: {
                    orderBy: { startDate: 'desc' },
                },
                metrics: {
                    orderBy: { year: 'desc' },
                },
                surveillanceAlerts: {
                    orderBy: { publishedAt: 'desc' },
                },
                logicalQuestions: {
                    orderBy: { createdAt: 'asc' }
                },
            },
        });

        if (!term) {
            return NextResponse.json({ error: 'Term not found' }, { status: 404 });
        }

        // Map metrics for unified frontend consumption
        const { metrics, ...rest } = term;
        const responseData = {
            ...rest,
            epidemiologyMetrics: metrics,
        };

        return NextResponse.json(responseData);
    } catch (error: any) {
        console.error('Fetch term details error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch medical term details.' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json({ error: 'Term ID is required.' }, { status: 400 });
        }

        const term = await prisma.medicalTerm.findUnique({ where: { id } });
        if (!term) {
            return NextResponse.json({ error: 'Term not found' }, { status: 404 });
        }

        // Hard delete
        await prisma.medicalTerm.deleteMany({ where: { id } });
        console.log(`[ADMIN] Successfully deleted medical term: ${id}`);

        return NextResponse.json({
            message: `Term "${term.name}" deleted successfully.`,
        });
    } catch (error: any) {
        console.error('Delete medical term error:', error);
        return NextResponse.json({ error: error.message || 'Failed to delete medical term.' }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'Term ID is required.' }, { status: 400 });
        }

        const term = await prisma.medicalTerm.findUnique({ where: { id } });
        if (!term) {
            return NextResponse.json({ error: 'Term not found' }, { status: 404 });
        }

        const updateData: any = {};
        if (body.name !== undefined) updateData.name = body.name;
        if (body.category !== undefined) updateData.category = body.category;

        const updated = await prisma.medicalTerm.update({
            where: { id },
            data: updateData
        });

        console.log(`[ADMIN] Successfully updated medical term: ${id}`, updateData);

        return NextResponse.json({
            message: `Term updated successfully.`,
            term: updated
        });
    } catch (error: any) {
        console.error('Update medical term error:', error);
        return NextResponse.json({ error: error.message || 'Failed to update medical term.' }, { status: 500 });
    }
}

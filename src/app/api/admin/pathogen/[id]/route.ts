import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json({ error: 'Pathogen ID is required.' }, { status: 400 });
        }

        const pathogen = await prisma.pathogen.findUnique({ where: { id } });
        if (!pathogen) {
            return NextResponse.json({ error: 'Pathogen not found.' }, { status: 404 });
        }

        console.log(`[ADMIN] Deleting pathogen: ${id}`);
        await prisma.pathogen.deleteMany({ where: { id } });
        console.log(`[ADMIN] Successfully deleted pathogen: ${id}`);

        return NextResponse.json({
            message: `Pathogen "${pathogen.name}" deleted successfully.`,
        });
    } catch (error: any) {
        console.error('Delete pathogen error:', error);
        return NextResponse.json({ error: error.message || 'Failed to delete pathogen.' }, { status: 500 });
    }
}

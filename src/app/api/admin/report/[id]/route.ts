import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;

        await prisma.marketReport.delete({
            where: { id }
        });

        return NextResponse.json({ success: true, message: 'Report deleted successfully.' });
    } catch (error: any) {
        console.error('Delete report error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

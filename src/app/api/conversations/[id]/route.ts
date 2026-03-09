import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const conversationId = id;
        if (!conversationId) {
            return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
        }

        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: {
                messages: {
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        if (!conversation) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
        }

        return NextResponse.json({ conversation });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const conversationId = id;
        if (!conversationId) {
            return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
        }

        console.log(`[API] Deleting conversation: ${conversationId}`);

        // Using deleteMany is safer as it doesn't throw if the record is missing
        await prisma.conversation.deleteMany({
            where: { id: conversationId }
        });

        console.log(`[API] Successfully deleted conversation: ${conversationId}`);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error(`[API] Failed to delete conversation ${params}:`, error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

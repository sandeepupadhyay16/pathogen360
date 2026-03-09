import { NextResponse } from 'next/server';
import { abortOperation } from '@/lib/operations';

export async function POST(request: Request) {
    try {
        const { id } = await request.json();
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        await abortOperation(id);
        return NextResponse.json({ message: 'Abort signal sent' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

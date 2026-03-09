import { NextResponse } from 'next/server';
import { generateAndSaveReport } from '@/lib/report-service';

export async function POST(request: Request) {
    try {
        const { pathogenId } = await request.json();

        if (!pathogenId) {
            return NextResponse.json({ error: 'pathogenId is required' }, { status: 400 });
        }

        const report = await generateAndSaveReport(pathogenId);

        return NextResponse.json({
            message: 'Report generated successfully',
            reportId: report.id,
            report
        });

    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

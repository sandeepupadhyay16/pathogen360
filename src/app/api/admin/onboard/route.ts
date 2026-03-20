import { NextResponse } from 'next/server';
import { createOperation } from '@/lib/operations';
import { executeOnboardTask } from '@/lib/tasks/onboard';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { medicalTerm, preset } = body;

        if (!medicalTerm) {
            return NextResponse.json({ error: 'Medical term is required' }, { status: 400 });
        }

        // Apply presets
        let params = { ...body };
        if (preset === 'quick') {
            params = {
                ...params,
                timeframe: '5y',
                pubmedDetails: 'abstract',
                maxResults: 50
            };
        } else if (preset === 'deep') {
            params = {
                ...params,
                timeframe: '5y',
                pubmedDetails: 'full',
                maxResults: 250
            };
        }
        // 'custom' uses the values passed in body

        const operation = await createOperation('ONBOARD', medicalTerm, { ...params });

        executeOnboardTask(operation.id, params).catch(err => {
            console.error(`Onboarding Operation ${operation.id} failed:`, err);
        });

        return NextResponse.json({
            message: 'Onboarding started in background',
            operationId: operation.id
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

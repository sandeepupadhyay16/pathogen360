import { NextResponse } from 'next/server';

/**
 * GET /api/admin/cron/refresh-clinical-trials
 * 
 * Designed to be called by a cron job (e.g. crontab or Vercel Cron).
 * Triggers the full clinical trials refresh by calling the refresh endpoint.
 * 
 * To set up a weekly cron on Linux, add this to crontab:
 *   0 3 * * 0  curl -s http://localhost:3000/api/admin/cron/refresh-clinical-trials >> /var/log/ct_cron.log 2>&1
 * (Runs every Sunday at 3:00 AM)
 */
export async function GET(request: Request) {
    // Validate secret token to prevent unauthorized triggering
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');

    // Use a simple shared secret — in production, set this as an env variable
    const CRON_SECRET = process.env.CRON_SECRET || 'pathogen360-cron';

    if (secret !== CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // Fire-and-forget the refresh
    fetch(`${baseUrl}/api/admin/refresh-clinical-trials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
    }).catch(err => console.error('[CronJob] Clinical trials refresh failed:', err));

    const now = new Date().toISOString();
    console.log(`[CronJob] Clinical trials refresh triggered at ${now}`);

    return NextResponse.json({
        status: 'triggered',
        message: 'Clinical trials refresh started in background.',
        triggeredAt: now
    });
}

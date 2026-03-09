
const { fetchTrials } = require('./src/lib/tasks/trials');

async function test() {
    console.log('Testing fetchTrials with limit 5...');
    try {
        const trials5 = await fetchTrials('Ebola', 5);
        console.log(`Fetched ${trials5.length} trials (expected <= 5)`);
        
        console.log('Testing fetchTrials with limit 10...');
        const trials10 = await fetchTrials('Ebola', 10);
        console.log(`Fetched ${trials10.length} trials (expected <= 10, likely 10)`);
        
        if (trials10.length > trials5.length || trials5.length === 5) {
            console.log('Verification SUCCESS: fetchTrials respects the limit parameter.');
        } else {
            console.log('Verification FAILURE: fetchTrials does not seem to respect the limit.');
        }
    } catch (err) {
        console.error('Test failed:', err);
    }
}

test();

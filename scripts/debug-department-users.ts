
import 'dotenv/config';
import { db } from '../server/db';
import { departments } from '../shared/schema';

async function test() {
    try {
        console.log('Testing DB connection...');
        console.log('DB object exists:', !!db);

        // Test query
        const res = await db.select().from(departments).limit(5);
        console.log('Departments found:', res.length);
        console.log('Sample:', JSON.stringify(res, null, 2));
    } catch (e) {
        console.error('Script Error:', e);
    }
    process.exit(0);
}
test();

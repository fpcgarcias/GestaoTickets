
import 'dotenv/config';
import { db, initDb } from '../server/db';
import { inventoryResponsibilityTerms } from '@shared/schema';
import { eq } from 'drizzle-orm';
import responsibilityTermService from '../server/services/responsibility-term-service';

async function main() {
    await initDb();
    const termId = 18;
    console.log(`Fetching term ${termId}...`);

    const [term] = await db
        .select()
        .from(inventoryResponsibilityTerms)
        .where(eq(inventoryResponsibilityTerms.id, termId));

    if (!term) {
        console.error('Term not found');
        return;
    }

    console.log('Term found:', term);

    try {
        console.log('Attempting to regenerate PDF...');
        const buffer = await responsibilityTermService.regenerateTermPdf(termId, term.company_id);
        console.log('PDF regenerated successfully, buffer size:', buffer.length);
    } catch (error) {
        console.error('Error regenerating PDF:', error);
    }
}

main().catch(console.error);

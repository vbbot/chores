import { importFoodComCsv } from './import';

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Usage: npm run food:import-recipes -- <recipes.csv>');
    process.exit(1);
  }
  const result = await importFoodComCsv({ csvPath });
  console.log(`Imported ${result.imported} recipes, skipped ${result.skipped}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

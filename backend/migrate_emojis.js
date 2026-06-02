const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  const { data: companions, error } = await supabase.from('companions').select('id, companion_name');
  if (error) {
    console.error('Error fetching companions:', error);
    return;
  }
  
  for (const c of companions) {
    if (!c.companion_name.includes('|')) {
      const newName = `🫂|${c.companion_name}`;
      await supabase.from('companions').update({ companion_name: newName }).eq('id', c.id);
      console.log(`Updated ${c.companion_name} -> ${newName}`);
    }
  }
  console.log('Done!');
}
run();

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://iaukydzbcdmglqajllei.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_AqWrf6GufnWU-Esd3MkLvQ_xoGFCUlL";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
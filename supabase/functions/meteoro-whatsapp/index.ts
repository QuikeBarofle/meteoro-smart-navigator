import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { createWebhook } from './handler.mjs';
const config = {
  receiveEnabled:Deno.env.get('METEORO_WHATSAPP_RECEIVE_ENABLED') === 'true',
  appSecret:Deno.env.get('METEORO_WHATSAPP_APP_SECRET') || '',
  verifyToken:Deno.env.get('METEORO_WHATSAPP_VERIFY_TOKEN') || '',
  phoneNumberId:Deno.env.get('METEORO_WHATSAPP_PHONE_NUMBER_ID') || '',
  businessAccountId:Deno.env.get('METEORO_WHATSAPP_BUSINESS_ACCOUNT_ID') || ''
};
const db = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{
  auth:{persistSession:false,autoRefreshToken:false}
});
Deno.serve(createWebhook({config,receive:async (args:Record<string,unknown>) => {
  const {data,error}=await db.rpc('meteoro_whatsapp_receive',args);
  if(error) throw new Error('Inbox storage unavailable');
  return data;
}}));

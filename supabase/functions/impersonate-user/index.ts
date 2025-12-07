import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get the authorization header to verify the caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify the calling user is an admin
    const supabaseAnon = createClient(
      supabaseUrl, 
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    
    const { data: { user: callingUser }, error: userError } = await supabaseAnon.auth.getUser();
    if (userError || !callingUser) {
      console.error('Failed to get calling user:', userError);
      throw new Error('Unauthorized');
    }

    // Check if calling user is admin
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', callingUser.id)
      .eq('role', 'admin');

    if (rolesError || !roles || roles.length === 0) {
      console.error('User is not admin:', rolesError);
      throw new Error('Only admins can impersonate users');
    }

    const { targetUserId } = await req.json();
    
    if (!targetUserId) {
      throw new Error('Target user ID is required');
    }

    console.log(`Admin ${callingUser.email} impersonating user ${targetUserId}`);

    // Generate a magic link for the target user (this creates a session)
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: '', // Will be filled by looking up the user
    });

    // Instead of magic link, we'll use a different approach - create a session directly
    // First, get the target user's email
    const { data: targetUser, error: targetUserError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
    
    if (targetUserError || !targetUser?.user) {
      console.error('Failed to get target user:', targetUserError);
      throw new Error('Target user not found');
    }

    // Generate a one-time login link
    const { data: otpData, error: otpError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: targetUser.user.email!,
      options: {
        redirectTo: `${req.headers.get('origin') || 'https://lovable.dev'}/dashboard`,
      }
    });

    if (otpError) {
      console.error('Failed to generate impersonation link:', otpError);
      throw new Error('Failed to generate impersonation link');
    }

    console.log('Successfully generated impersonation link for:', targetUser.user.email);

    return new Response(
      JSON.stringify({ 
        success: true,
        // Return the hashed token from the link for client-side verification
        actionLink: otpData.properties?.action_link,
        email: targetUser.user.email,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Impersonation error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});

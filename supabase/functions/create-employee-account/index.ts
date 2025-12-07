import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateAccountRequest {
  employee_id: string;
  email: string;
  full_name: string;
  default_password?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get the authorization header to validate the requesting user is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate the user is an admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Failed to get user from token:', userError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has admin role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleData) {
      console.error('User is not an admin:', roleError?.message);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { employee_id, email, full_name, default_password = 'Welcome@123' }: CreateAccountRequest = await req.json();

    console.log(`Creating account for employee: ${employee_id} (${email})`);

    // Validate email domain
    if (!email.toLowerCase().endsWith('@azentio.com')) {
      console.error('Invalid email domain:', email);
      return new Response(
        JSON.stringify({ error: 'Only @azentio.com emails are allowed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if employee exists and doesn't already have an auth account
    const { data: employee, error: empError } = await supabaseAdmin
      .from('employees')
      .select('id, auth_user_id, email, full_name')
      .eq('email', email)
      .single();

    if (empError || !employee) {
      console.error('Employee not found:', empError?.message);
      return new Response(
        JSON.stringify({ error: 'Employee not found in system' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (employee.auth_user_id) {
      console.log('Employee already has an auth account:', employee.auth_user_id);
      return new Response(
        JSON.stringify({ error: 'Employee already has an account', existing: true }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create auth user with admin API (no email sent, email_confirmed = true)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: default_password,
      email_confirm: true, // Mark email as verified immediately
      user_metadata: {
        full_name: full_name,
        employee_id: employee_id
      }
    });

    if (authError) {
      console.error('Failed to create auth user:', authError.message);
      return new Response(
        JSON.stringify({ error: `Failed to create account: ${authError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newUserId = authData.user.id;
    console.log(`Auth user created with ID: ${newUserId}`);

    // Update employee record with auth_user_id
    const { error: updateEmpError } = await supabaseAdmin
      .from('employees')
      .update({ auth_user_id: newUserId })
      .eq('id', employee.id);

    if (updateEmpError) {
      console.error('Failed to update employee with auth_user_id:', updateEmpError.message);
      // Note: Auth user is already created, so we continue
    }

    // Check if profile already exists (it should be created by trigger)
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', newUserId)
      .single();

    if (!existingProfile) {
      // Create profile record if trigger didn't create it
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: newUserId,
          email: email,
          full_name: full_name,
          employee_id: employee_id
        });

      if (profileError) {
        console.error('Failed to create profile:', profileError.message);
        // Non-critical error, continue
      } else {
        console.log('Profile created for user:', newUserId);
      }
    } else {
      console.log('Profile already exists for user:', newUserId);
    }

    // Assign sales_rep role to the new user
    const { error: roleInsertError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: newUserId,
        role: 'sales_rep'
      });

    if (roleInsertError) {
      console.error('Failed to assign role:', roleInsertError.message);
      // Non-critical, continue
    } else {
      console.log('Assigned sales_rep role to user:', newUserId);
    }

    console.log(`Successfully created account for ${email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: newUserId,
        message: `Account created for ${email}. Temporary password: ${default_password}`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

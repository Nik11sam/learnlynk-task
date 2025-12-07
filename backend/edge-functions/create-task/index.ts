import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateTaskRequest {
  application_id: string;
  task_type: string;
  due_at: string;
}

serve(async (req) => {
  // Handling CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Parse request body
    const body: CreateTaskRequest = await req.json();
    const { application_id, task_type, due_at } = body;

    // Validate task_type
    const validTaskTypes = ["call", "email", "review"];
    if (!validTaskTypes.includes(task_type)) {
      return new Response(
        JSON.stringify({ error: "invalid task_type" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate due_at
    const dueAtDate = new Date(due_at);
    const now = new Date();

    if (isNaN(dueAtDate.getTime()) || dueAtDate <= now) {
      return new Response(
        JSON.stringify({ error: "invalid due_at" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch application to get tenant_id
    const { data: application, error: appError } = await supabase
      .from("applications")
      .select("tenant_id")
      .eq("id", application_id)
      .single();

    if (appError || !application) {
      return new Response(
        JSON.stringify({ error: "application not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Insert task
    const { data: task, error: insertError } = await supabase
      .from("tasks")
      .insert({
        application_id,
        type: task_type,
        due_at,
        tenant_id: application.tenant_id,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError || !task) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "internal_error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, task_id: task.id }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "internal_error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
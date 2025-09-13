// Import necessary libraries
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// Define the response headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req ) => {
  // Handle preflight requests for CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Create a Supabase client with the service_role key
    // This key has admin privileges and bypasses RLS policies.
    // It's safe to use here because this code runs on the server.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 2. Find the currently active season that has ended
    const now = new Date().toISOString();
    const { data: endedSeasons, error: seasonError } = await supabaseAdmin
      .from('seasons')
      .select('*')
      .eq('is_active', true)
      .lt('end_date', now); // Find seasons where the end_date is in the past

    if (seasonError) throw seasonError;

    // If no season has ended, do nothing.
    if (endedSeasons.length === 0) {
      return new Response(JSON.stringify({ message: "No active season has ended." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const season = endedSeasons[0];
    console.log(`Processing end of season: ${season.name} (ID: ${season.id})`);

    // 3. Get the top players from the seasonal leaderboard
    const { data: topPlayers, error: playersError } = await supabaseAdmin
      .from('players')
      .select('id, seasonal_xp, titles')
      .order('seasonal_xp', { ascending: false })
      .gt('seasonal_xp', 0) // Only consider players who participated
      .limit(10); // Get top 10 players

    if (playersError) throw playersError;

    // 4. Get the rewards for this season
    const { data: rewards, error: rewardsError } = await supabaseAdmin
      .from('season_rewards')
      .select('*')
      .eq('season_id', season.id);

    if (rewardsError) throw rewardsError;

    // 5. Distribute rewards to the winners
    for (let i = 0; i < topPlayers.length; i++) {
      const player = topPlayers[i];
      const rank = i + 1;
      const rewardInfo = rewards.find(r => r.rank === rank);

      if (rewardInfo) {
        console.log(`Distributing rewards to rank ${rank} (Player ID: ${player.id})`);
        
        // Add the new title to the player's existing titles
        const newTitles = player.titles ? [...player.titles, rewardInfo.title_reward] : [rewardInfo.title_reward];

        // Update the player's diamonds and titles
        await supabaseAdmin
          .from('players')
          .update({
            diamonds: supabaseAdmin.rpc('increment_diamonds', { user_id: player.id, amount: rewardInfo.diamonds_reward }),
            titles: newTitles
          })
          .eq('id', player.id);
      }
    }

    // 6. Reset seasonal_xp for all players
    console.log("Resetting seasonal XP for all players...");
    await supabaseAdmin
      .from('players')
      .update({ seasonal_xp: 0 })
      .gt('seasonal_xp', 0); // Only update players who had points

    // 7. Deactivate the ended season
    await supabaseAdmin
      .from('seasons')
      .update({ is_active: false })
      .eq('id', season.id);

    // (Optional) 8. Activate the next season
    // You can add logic here to find and activate the next season in the sequence.

    return new Response(JSON.stringify({ message: `Season ${season.name} processed successfully.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

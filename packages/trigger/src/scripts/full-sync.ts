import { createClient } from "@supabase/supabase-js";
import { getChannelMetadata, getChannelVideos } from "../lib/youtube.js";
import { fetchTranscript } from "../lib/transcript.js";
import { generateSummary } from "../lib/summarize.js";
import { upsertSource, insertVideo, supabase } from "../lib/db.js";

const MIN_DURATION_SECONDS = 20 * 60;
const MAX_VIDEOS = 10;

interface Source {
  id: string;
  handle: string;
  name: string;
  is_active: boolean;
  external_id: string;
}

async function processChannel(handle: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Processing channel: ${handle}`);
  console.log("=".repeat(60));

  const channel = await getChannelMetadata(handle);
  console.log(`Channel: ${channel.name} (${channel.id})`);

  const sourceId = await upsertSource({
    externalId: channel.id,
    handle,
    name: channel.name,
    description: channel.description,
    thumbnailUrl: channel.thumbnailUrl,
    bannerUrl: channel.bannerUrl,
    subscriberCount: channel.subscriberCount,
    videoCount: channel.videoCount,
  });
  console.log(`Source upserted with ID: ${sourceId}`);

  console.log("Fetching channel videos...");
  const allVideos = await getChannelVideos(channel.id, 50);
  console.log(`Found ${allVideos.length} total videos`);

  const eligibleVideos = allVideos.filter(
    (v) => v.duration >= MIN_DURATION_SECONDS
  );
  const videosToProcess = eligibleVideos.slice(0, MAX_VIDEOS);
  console.log(
    `${eligibleVideos.length} videos >= 20 min, processing ${videosToProcess.length}`
  );

  // Check which videos already exist
  const externalIds = videosToProcess.map((v) => v.id);
  const { data: existingVideos } = await supabase
    .from("videos")
    .select("external_id")
    .in("external_id", externalIds);

  const existingSet = new Set(
    (existingVideos || []).map((v: { external_id: string }) => v.external_id)
  );
  const newVideos = videosToProcess.filter((v) => !existingSet.has(v.id));
  console.log(
    `${existingSet.size} already in DB, ${newVideos.length} new videos to process`
  );

  let processed = 0;
  let transcriptsFound = 0;
  let summariesGenerated = 0;

  for (const video of newVideos) {
    try {
      console.log(
        `  [${processed + 1}/${newVideos.length}] ${video.title}`
      );

      const transcript = await fetchTranscript(video.id);
      if (transcript) {
        transcriptsFound++;
        console.log(
          `    Transcript: ${transcript.content.length} chars (${transcript.language})`
        );
      } else {
        console.log(`    No transcript available`);
      }

      let summary: string | undefined;
      if (transcript) {
        try {
          summary = await generateSummary(transcript.content, video.title);
          summariesGenerated++;
          console.log(`    Summary generated (${summary.length} chars)`);
        } catch (err) {
          console.error(`    Summary generation failed: ${err}`);
        }
      }

      await insertVideo({
        sourceId,
        externalId: video.id,
        url: video.url,
        title: video.title,
        description: video.description,
        durationSeconds: video.duration,
        durationString: video.durationString,
        thumbnailUrl: video.thumbnailUrl,
        uploadDate: video.uploadDate,
        publishedAt: video.publishedAt,
        viewCount: video.viewCount,
        likeCount: video.likeCount,
        commentCount: video.commentCount,
        transcript: transcript?.content,
        transcriptLanguage: transcript?.language,
        summary,
      });

      processed++;
      console.log(`    Saved to DB`);
    } catch (err) {
      console.error(`    Failed: ${err}`);
    }
  }

  return {
    channel: channel.name,
    handle,
    sourceId,
    totalVideosFound: allVideos.length,
    eligible: eligibleVideos.length,
    alreadyInDb: existingSet.size,
    processed,
    transcriptsFound,
    summariesGenerated,
  };
}

async function fullSync() {
  console.log("Starting full sync...");
  console.log(`Time: ${new Date().toISOString()}\n`);

  const { data: sources, error } = await supabase
    .from("sources")
    .select("id, handle, name, is_active, external_id")
    .eq("is_active", true)
    .order("name");

  if (error) {
    console.error("Failed to fetch sources:", error.message);
    process.exit(1);
  }

  if (!sources || sources.length === 0) {
    console.log("No active sources found in the database.");
    process.exit(0);
  }

  console.log(`Found ${sources.length} active source(s):`);
  for (const source of sources) {
    console.log(`  - ${source.name} (${source.handle})`);
  }

  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (const source of sources) {
    try {
      const result = await processChannel(source.handle);
      results.push(result);
      successCount++;
    } catch (err) {
      console.error(`\nFailed to process ${source.handle}: ${err}`);
      failCount++;
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("FULL SYNC COMPLETE");
  console.log("=".repeat(60));
  console.log(`Channels processed: ${successCount}/${sources.length}`);
  if (failCount > 0) console.log(`Failed: ${failCount}`);

  for (const r of results) {
    console.log(`\n  ${r.channel} (${r.handle}):`);
    console.log(`    Videos found: ${r.totalVideosFound}, Eligible: ${r.eligible}`);
    console.log(`    Already in DB: ${r.alreadyInDb}, New processed: ${r.processed}`);
    console.log(`    Transcripts: ${r.transcriptsFound}, Summaries: ${r.summariesGenerated}`);
  }

  console.log(`\nFinished at: ${new Date().toISOString()}`);
}

fullSync().catch((err) => {
  console.error("Full sync failed:", err);
  process.exit(1);
});
